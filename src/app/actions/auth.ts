"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { enforceRateLimit } from "@/lib/auth/rate-limit"
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type ResetPasswordInput,
} from "@/lib/auth/schemas"
import { db } from "@/db"
import { recordAudit, resolveActorLabel } from "@/lib/audit/audit"

type ActionResult = { error?: string }

const TOO_MANY_ATTEMPTS_ERROR = "Trop de tentatives. Réessayez dans quelques minutes."

// Server Actions d'authentification. Elles revalident les données avec les
// mêmes schémas Zod que les formulaires (src/lib/auth/schemas.ts) avant
// d'appeler l'API serveur de Better Auth — la validation ne repose donc pas
// uniquement sur le client.
//
// Limitation de débit : le rate limiting HTTP de Better Auth (rateLimit
// dans src/lib/auth/index.ts) ne s'applique qu'aux requêtes qui passent par son
// routeur (auth.handler) — pas aux appels directs à auth.api.* faits ici.
// Or une Server Action est elle-même un point d'entrée HTTP invocable
// publiquement (Next.js expose un endpoint POST dédié pour chacune) : sans
// limite propre, elle contournerait entièrement la protection contre le
// bourrage d'identifiants ou de courriels. enforceRateLimit
// (src/lib/auth/rate-limit.ts) comble cet écart, avec les mêmes seuils que les
// règles HTTP équivalentes et la même politique d'activation
// (RATE_LIMIT_ENABLED, production uniquement).

export async function loginAction(values: LoginInput): Promise<ActionResult> {
  // Même seuil que la règle HTTP /sign-in/email (voir src/lib/auth/index.ts) :
  // 10 tentatives par minute par IP. Vérifié avant la validation Zod, pour
  // rester cohérent avec l'ordre du routeur de Better Auth (la limite
  // s'applique avant même l'examen de la requête).
  const { limited } = await enforceRateLimit("login", { window: 60, max: 10 })
  if (limited) {
    return { error: TOO_MANY_ATTEMPTS_ERROR }
  }

  const parsed = loginSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Courriel ou mot de passe invalide." }
  }

  try {
    await auth.api.signInEmail({
      body: parsed.data,
      headers: await headers(),
    })
  } catch {
    return { error: "Courriel ou mot de passe invalide." }
  }

  redirect("/tableau-de-bord")
}

export async function forgotPasswordAction(
  values: ForgotPasswordInput,
): Promise<void> {
  // Même seuil que la règle HTTP /request-password-reset : 5 tentatives par
  // 15 minutes par IP. En cas de dépassement, on retourne silencieusement —
  // exactement comme le chemin de succès — pour ne jamais révéler par ce
  // biais qu'un compte existe ou non.
  const { limited } = await enforceRateLimit("forgot-password", {
    window: 60 * 15,
    max: 5,
  })
  if (limited) return

  const parsed = forgotPasswordSchema.safeParse(values)
  if (!parsed.success) return

  try {
    await auth.api.requestPasswordReset({
      body: {
        email: parsed.data.email,
        redirectTo: "/reinitialiser-mot-de-passe",
      },
      headers: await headers(),
    })
  } catch {
    // Volontairement ignoré : la page affiche toujours le même message
    // neutre, qu'un compte existe ou non, pour éviter l'énumération de
    // comptes par courriel.
  }
}

export async function resetPasswordAction(
  values: ResetPasswordInput,
  token: string | undefined,
): Promise<ActionResult> {
  if (!token) {
    return { error: "Ce lien de réinitialisation est invalide ou a expiré." }
  }

  // Limite propre à cette action (pas d'équivalent direct côté HTTP) : 10
  // tentatives par 15 minutes par IP, pour ralentir une attaque par force
  // brute sur le jeton de réinitialisation.
  const { limited } = await enforceRateLimit("reset-password", {
    window: 60 * 15,
    max: 10,
  })
  if (limited) {
    return { error: TOO_MANY_ATTEMPTS_ERROR }
  }

  const parsed = resetPasswordSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Les mots de passe ne correspondent pas." }
  }

  // `auth.api.resetPassword` (voir node_modules/better-auth/dist/api/routes/
  // password.mjs) ne retourne que `{ status: true }` — jamais l'utilisateur
  // concerné, donc pas moyen de résoudre l'acteur À PARTIR de son résultat.
  // On lit donc, AVANT l'appel, la valeur (l'identifiant utilisateur) du
  // jeton de vérification que Better Auth consommera lui-même dans
  // `resetPassword` — via `findVerificationValue` (adaptateur interne), une
  // lecture SANS consommation, sous le même identifiant que Better Auth
  // utilise en interne (`reset-password:${token}`, voir
  // requestPasswordResetCallback dans le même fichier) : le jeton reste donc
  // valide pour l'appel `resetPassword` qui suit. Si ce jeton est déjà
  // invalide/expiré à ce stade, `verification` est `null` — `resetPassword`
  // échouera de toute façon juste après avec la même erreur générique.
  const context = await auth.$context
  const verification = await context.internalAdapter.findVerificationValue(
    `reset-password:${token}`,
  )
  const actorId = typeof verification?.value === "string" ? verification.value : null

  try {
    await auth.api.resetPassword({
      body: { newPassword: parsed.data.password, token },
      headers: await headers(),
    })
  } catch {
    return { error: "Ce lien de réinitialisation est invalide ou a expiré." }
  }

  const actorLabel = await resolveActorLabel(db, actorId)
  await recordAudit(db, {
    actorId,
    actorLabel,
    action: "auth.password.reset",
    targetType: "user",
    targetId: actorId,
    targetLabel: actorLabel,
  })

  redirect("/")
}
