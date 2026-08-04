/**
 * Création d'un utilisateur avec mot de passe, en passant par l'adaptateur
 * interne de Better Auth (context.internalAdapter + context.password.hash)
 * plutôt que par l'API HTTP publique — qui refuse toute inscription (voir
 * emailAndPassword.disableSignUp dans src/lib/auth/index.ts). C'est le seul
 * moyen de créer un compte pour ce template.
 *
 * Extrait de scripts/create-admin.ts (qui l'utilise pour le tout premier
 * compte administrateur) pour être réutilisé par createUserAction
 * (src/app/actions/users.ts), qui crée les comptes suivants depuis
 * /administration/utilisateurs.
 */
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { getRole } from "@/lib/auth/roles";
import { recordAudit, resolveActorLabel } from "@/lib/audit/audit";

export type CreateUserWithPasswordInput = {
  name: string;
  email: string;
  password: string;
  role: string;
  // Auteur de la création, pour le journal d'audit (voir recordAudit
  // ci-dessous) : `null` pour scripts/create-admin.ts (exécuté hors de
  // toute session, avant que le premier compte n'existe) — enregistré alors
  // comme "Système". La Server Action (src/app/actions/users.ts) passe
  // toujours l'identifiant de l'administrateur connecté.
  actorId: string | null;
};

export type CreatedUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export async function createUserWithPassword(
  input: CreateUserWithPasswordInput,
): Promise<CreatedUser> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  const role = await getRole(input.role);
  if (!role) {
    throw new Error(`Le rôle « ${input.role} » est introuvable.`);
  }

  const context = await auth.$context;

  // Compromis assumé : `findUserByEmail` (adaptateur interne de Better Auth)
  // ne sait rien de `user.deleted_at` (voir src/db/schema.ts et la
  // suppression douce dans src/lib/auth/users.ts) — un courriel ayant
  // appartenu à un utilisateur supprimé reste donc refusé ici comme s'il
  // était toujours pris. On ne corrige pas ce comportement : le rendre
  // possible demanderait de contourner l'adaptateur (requête directe sur
  // `user` en ignorant `deleted_at`), pour un bénéfice mince — restaurer un
  // compte supprimé est de toute façon une opération manuelle en base pour
  // l'instant (pas d'UI de restauration), l'administrateur peut aussi bien y
  // réactiver l'ancien compte (deleted_at = NULL) plutôt que d'en créer un
  // nouveau avec le même courriel.
  const existing = await context.internalAdapter.findUserByEmail(email);
  if (existing) {
    throw new Error(`Un compte existe déjà avec le courriel « ${email} ».`);
  }

  const hashedPassword = await context.password.hash(input.password);

  const createdUser = await context.internalAdapter.createUser({
    name,
    email,
    emailVerified: true,
    role: role.id,
  });

  await context.internalAdapter.linkAccount({
    userId: createdUser.id,
    providerId: "credential",
    accountId: createdUser.id,
    password: hashedPassword,
  });

  // Enregistré APRÈS la création complète (utilisateur + compte credential
  // liés), pas dans une transaction commune avec elles : les deux appels
  // ci-dessus passent par l'adaptateur interne de Better Auth
  // (context.internalAdapter), pas par notre propre `db.transaction` — il
  // n'y a donc pas de transaction Drizzle à laquelle rattacher cette entrée
  // (voir AuditExecutor dans src/lib/audit/audit.ts pour le mécanisme
  // d'atomicité, utilisé ailleurs où une vraie transaction existe, ex.
  // src/lib/auth/users.ts).
  const actorLabel = await resolveActorLabel(db, input.actorId);
  await recordAudit(db, {
    actorId: input.actorId,
    actorLabel,
    action: "user.create",
    targetType: "user",
    targetId: createdUser.id,
    targetLabel: `${createdUser.name} (${createdUser.email})`,
    details: { role: role.id },
  });

  return { id: createdUser.id, name: createdUser.name, email: createdUser.email, role: role.id };
}
