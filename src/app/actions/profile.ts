"use server"

import { headers } from "next/headers"
import { eq } from "drizzle-orm"
import { APIError } from "better-auth"

import { auth } from "@/lib/auth"
import { db } from "@/db"
import { session as sessionTable } from "@/db/schema"
import { recordAudit, resolveActorLabel } from "@/lib/audit/audit"
import {
  changePasswordSchema,
  updateNameSchema,
  type ChangePasswordInput,
  type UpdateNameInput,
} from "@/lib/auth/schemas"

type ActionResult = { error?: string }

// Server Actions de la page /profil. Comme src/app/actions/auth.ts, elles
// revalident avec les mêmes schémas Zod que les formulaires avant d'appeler
// l'API serveur de Better Auth. Chacune enregistre désormais son entrée dans
// le journal d'audit (src/lib/audit/audit.ts) : contrairement aux fonctions
// de src/lib/auth/users.ts, src/lib/auth/roles.ts et
// src/lib/settings/app-settings.ts, elles n'ont pas de transaction Drizzle
// propre à laquelle rattacher l'écriture (Better Auth gère lui-même
// l'écriture via `auth.api.*`) : `recordAudit` est donc appelé avec `db`
// directement, APRÈS le succès de l'appel Better Auth.

export async function updateNameAction(
  values: UpdateNameInput,
): Promise<ActionResult> {
  const parsed = updateNameSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Le nom est requis." }
  }

  const currentSession = await auth.api.getSession({ headers: await headers() })
  if (!currentSession) {
    return { error: "Vous devez être connecté pour effectuer cette action." }
  }

  try {
    await auth.api.updateUser({
      body: { name: parsed.data.name },
      headers: await headers(),
    })
  } catch {
    return { error: "Une erreur est survenue. Réessayez plus tard." }
  }

  const actorLabel = await resolveActorLabel(db, currentSession.user.id)
  await recordAudit(db, {
    actorId: currentSession.user.id,
    actorLabel,
    action: "profile.name.update",
    targetType: "user",
    targetId: currentSession.user.id,
    targetLabel: `${parsed.data.name} (${currentSession.user.email})`,
    details: { name: { before: currentSession.user.name, after: parsed.data.name } },
  })

  return {}
}

export async function changePasswordAction(
  values: ChangePasswordInput,
): Promise<ActionResult> {
  const parsed = changePasswordSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Les mots de passe saisis sont invalides." }
  }

  const currentSession = await auth.api.getSession({ headers: await headers() })
  if (!currentSession) {
    return { error: "Vous devez être connecté pour effectuer cette action." }
  }

  try {
    await auth.api.changePassword({
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        // Exigence de sécurité : une session volée ne doit pas survivre à un
        // changement de mot de passe. Better Auth révoque alors toutes les
        // sessions existantes et en recrée une nouvelle pour la session
        // courante (voir node_modules/better-auth/dist/api/routes/update-user.mjs).
        //
        // Cette recréation déclenche AUSSI le hook databaseHooks.session.
        // create.after (src/lib/auth/index.ts) : un changement de mot de
        // passe produit donc, en plus de l'entrée auth.password.change
        // ci-dessous, une entrée auth.login pour la session recréée — voir
        // le commentaire du hook pour ce choix assumé.
        revokeOtherSessions: true,
      },
      headers: await headers(),
    })
  } catch (error) {
    if (error instanceof APIError && error.body?.code === "INVALID_PASSWORD") {
      return { error: "Le mot de passe actuel est incorrect." }
    }
    return { error: "Une erreur est survenue. Réessayez plus tard." }
  }

  const actorLabel = await resolveActorLabel(db, currentSession.user.id)
  await recordAudit(db, {
    actorId: currentSession.user.id,
    actorLabel,
    action: "auth.password.change",
    targetType: "user",
    targetId: currentSession.user.id,
    targetLabel: actorLabel,
    details: { revokedOtherSessions: true },
  })

  return {}
}

export async function revokeSessionAction(token: string): Promise<ActionResult> {
  if (!token) {
    return { error: "Session invalide." }
  }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return { error: "Votre session a expiré. Reconnectez-vous." }
  }

  // Défense en profondeur : l'utilisateur ne doit jamais pouvoir se
  // déconnecter lui-même depuis cette action (le bouton « Révoquer » n'est
  // déjà pas affiché pour la session courante côté client).
  if (session.session.token === token) {
    return {
      error: "Vous ne pouvez pas révoquer votre session actuelle depuis cette page.",
    }
  }

  // Retrouve l'identifiant NON SECRET de la session ciblée (sa clé primaire
  // `id`, JAMAIS `token` — voir le commentaire de `details` dans
  // src/db/schema.ts : le journal d'audit ne doit jamais contenir de jeton,
  // qui donnerait un accès réel au compte à quiconque peut le lire) pour lui
  // donner une cible lisible dans le journal. Lu AVANT révocation : la
  // rangée `session` n'existera plus après.
  const [targetSession] = await db
    .select({ id: sessionTable.id, ipAddress: sessionTable.ipAddress })
    .from(sessionTable)
    .where(eq(sessionTable.token, token))
    .limit(1)

  try {
    await auth.api.revokeSession({
      body: { token },
      headers: await headers(),
    })
  } catch {
    return { error: "Impossible de révoquer cette session." }
  }

  const actorLabel = await resolveActorLabel(db, session.user.id)
  await recordAudit(db, {
    actorId: session.user.id,
    actorLabel,
    action: "session.revoke",
    targetType: "session",
    targetId: targetSession?.id ?? null,
    targetLabel: targetSession?.ipAddress
      ? `Session (${targetSession.ipAddress})`
      : "Session",
  })

  return {}
}

export async function revokeOtherSessionsAction(): Promise<ActionResult> {
  const currentSession = await auth.api.getSession({ headers: await headers() })
  if (!currentSession) {
    return { error: "Votre session a expiré. Reconnectez-vous." }
  }

  // Nombre de sessions révoquées par cette action = les sessions actives du
  // compte AUTRES que la courante, comptées AVANT révocation (la même
  // requête, refaite après, ne retournerait plus que la session courante).
  const activeSessions = await db
    .select({ id: sessionTable.id })
    .from(sessionTable)
    .where(eq(sessionTable.userId, currentSession.user.id))
  const otherSessionsCount = activeSessions.filter(
    (row) => row.id !== currentSession.session.id,
  ).length

  try {
    await auth.api.revokeOtherSessions({ headers: await headers() })
  } catch {
    return { error: "Impossible de déconnecter les autres sessions." }
  }

  const actorLabel = await resolveActorLabel(db, currentSession.user.id)
  await recordAudit(db, {
    actorId: currentSession.user.id,
    actorLabel,
    action: "session.revoke_others",
    targetType: "user",
    targetId: currentSession.user.id,
    targetLabel: actorLabel,
    details: { revokedCount: otherSessionsCount },
  })

  return {}
}
