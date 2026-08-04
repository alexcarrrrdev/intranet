import { eq } from "drizzle-orm";
import { APIError } from "better-auth";
import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { RATE_LIMIT_ENABLED } from "@/lib/auth/rate-limit";
import { recordAudit, resolveActorLabel } from "@/lib/audit/audit";

// Configuration serveur de Better Auth. Voir node_modules/better-auth pour
// l'API exacte de la version installée (elle évolue vite).
export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  // Le rate limiting de Better Auth n'est actif par défaut qu'en production
  // et stocké en mémoire (perdu à chaque redémarrage, non partagé entre
  // instances). On rend ce comportement explicite plutôt que de compter sur
  // le défaut implicite :
  //   - actif uniquement en production (RATE_LIMIT_ENABLED, définie dans
  //     src/lib/auth/rate-limit.ts et PARTAGÉE avec enforceRateLimit — les
  //     Server Actions de src/app/actions/auth.ts appellent auth.api.*
  //     directement, sans passer par le routeur HTTP de Better Auth qui
  //     applique cette configuration, et ont donc besoin de leur propre
  //     limite avec la même politique d'activation, pour ne jamais diverger
  //     entre les deux) ;
  //   - stocké en base de données (table "rateLimit", voir src/db/schema.ts)
  //     pour survivre aux redémarrages et fonctionner avec plusieurs
  //     instances de l'application derrière un même Postgres.
  rateLimit: {
    enabled: RATE_LIMIT_ENABLED,
    storage: "database",
    // Limite générale par défaut : 100 requêtes par minute par IP+route,
    // pour les routes qui n'ont pas de règle plus stricte ci-dessous.
    window: 60,
    max: 100,
    customRules: {
      // Connexion : 10 tentatives par minute par IP. Suffisant pour un
      // utilisateur qui se trompe de mot de passe à quelques reprises,
      // assez strict pour ralentir une attaque par force brute sur les
      // mots de passe.
      "/sign-in/email": { window: 60, max: 10 },
      // Demande de réinitialisation de mot de passe : 5 tentatives par
      // 15 minutes par IP, pour empêcher qu'un tiers ne déclenche l'envoi
      // massif de courriels de réinitialisation vers une adresse ciblée.
      "/request-password-reset": { window: 60 * 15, max: 5 },
    },
  },
  emailAndPassword: {
    enabled: true,
    // Pas d'inscription publique : les comptes sont créés par un
    // administrateur, via `npm run create-admin` (voir scripts/create-admin.ts).
    disableSignUp: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Réinitialisation de votre mot de passe",
        text: [
          `Bonjour ${user.name},`,
          "",
          "Une demande de réinitialisation de mot de passe a été effectuée pour votre compte.",
          "Cliquez sur le lien suivant pour choisir un nouveau mot de passe :",
          url,
          "",
          "Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce courriel.",
        ].join("\n"),
      });
    },
  },
  user: {
    additionalFields: {
      // Rôle applicatif de l'utilisateur, utilisé par src/lib/auth/permissions.ts.
      // `input: false` : le rôle ne peut pas être fourni via l'API publique
      // (création/mise à jour d'utilisateur) ; il est toujours défini côté
      // serveur (valeur par défaut "member", ou explicitement par
      // scripts/create-admin.ts).
      role: {
        type: "string",
        required: true,
        defaultValue: "member",
        input: false,
      },
    },
  },
  // Bloque la création de session pour un utilisateur supprimé (suppression
  // douce, voir `deletedAt` dans src/db/schema.ts et `deleteUser` dans
  // src/lib/auth/users.ts) DANS Better Auth lui-même, pas seulement dans nos
  // Server Actions (src/app/actions/users.ts) : `/api/auth/sign-in/email`
  // est un point d'entrée HTTP public (voir src/app/api/auth/[...all]/route.ts),
  // que Better Auth expose indépendamment de nos Server Actions — un appel
  // direct à cette route contournerait entièrement une vérification qui ne
  // vivrait que côté application.
  //
  // `session.create.before` est le hook vérifié empiriquement (voir
  // node_modules/better-auth/dist/db/internal-adapter.mjs, fonction
  // `createSession`, et node_modules/better-auth/dist/db/with-hooks.mjs,
  // fonction `createWithHooks`) : signInEmail crée la session via
  // `internalAdapter.createSession`, qui passe TOUJOURS par ce hook avant
  // d'écrire la rangée `session` — y compris pour un appel direct à
  // `auth.api.signInEmail` (voir src/lib/auth/auth.integration.test.ts). Lever
  // une erreur ici empêche donc la session d'exister, quel que soit le
  // chemin d'entrée.
  //
  // On lance la même erreur (« Invalid email or password », statut 401) que
  // celle que Better Auth lève déjà pour un mauvais mot de passe (voir
  // node_modules/better-auth/dist/api/routes/sign-in.mjs) : le formulaire de
  // connexion affiche dans les deux cas le même message générique
  // « Courriel ou mot de passe invalide. » (voir loginAction dans
  // src/app/actions/auth.ts, qui attrape toute erreur sans distinction) — un
  // tiers ne peut donc pas se servir de cette différence pour deviner qu'un
  // compte a été supprimé (énumération de comptes).
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const [target] = await db
            .select({ deletedAt: schema.user.deletedAt })
            .from(schema.user)
            .where(eq(schema.user.id, session.userId))
            .limit(1);

          if (target?.deletedAt) {
            throw new APIError("UNAUTHORIZED", {
              message: "Invalid email or password",
              code: "INVALID_EMAIL_OR_PASSWORD",
            });
          }
        },
        // Journal d'audit (auth.login, voir src/lib/audit/audit.ts) : ce
        // hook `after` est le pendant du `before` ci-dessus, DANS LE MÊME
        // point d'entrée Better Auth (createWithHooks, voir
        // node_modules/better-auth/dist/db/with-hooks.mjs) — il se déclenche
        // donc pour exactement les mêmes chemins de création de session que
        // `before` (signInEmail, y compris un appel direct à
        // `/api/auth/sign-in/email`), vérifié empiriquement dans
        // src/lib/audit/audit.integration.test.ts. Reçoit la session APRÈS
        // écriture (elle a donc déjà `id`/`userId`), contrairement à
        // `before` qui ne reçoit que les données AVANT écriture — les deux
        // exposent `session.userId` de la même façon, c'est tout ce dont on a
        // besoin ici.
        //
        // Piège à connaître : ce hook se déclenche aussi pour la session
        // RECRÉÉE après un changement de mot de passe avec
        // `revokeOtherSessions: true` (voir changePasswordAction,
        // src/app/actions/profile.ts, et le commentaire de
        // node_modules/better-auth/dist/api/routes/update-user.mjs) — un
        // changement de mot de passe produit donc DEUX entrées de journal
        // (auth.password.change ET auth.login) plutôt qu'une seule.
        // Assumé : la nouvelle session EST une connexion, au sens propre du
        // terme, même déclenchée indirectement.
        //
        // `resolveActorLabel`/`recordAudit` utilisent `db` directement (pas
        // de transaction Drizzle à disposition ici : l'écriture de la
        // session, elle, est gérée entièrement par l'adaptateur interne de
        // Better Auth, pas par notre propre `db.transaction`).
        after: async (session) => {
          const actorLabel = await resolveActorLabel(db, session.userId);
          await recordAudit(db, {
            actorId: session.userId,
            actorLabel,
            action: "auth.login",
            targetType: "user",
            targetId: session.userId,
            targetLabel: actorLabel,
          });
        },
      },
    },
  },
  // Doit rester le dernier plugin : il permet aux appels serveur
  // (auth.api.*) de propager les cookies de session via `next/headers`.
  plugins: [nextCookies()],
});
