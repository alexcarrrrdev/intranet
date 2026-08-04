"use server"

import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { createUserWithPassword } from "@/lib/auth/create-user"
import { requirePermission } from "@/lib/auth/permissions"
import { deleteUser, updateUser } from "@/lib/auth/users"
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from "@/lib/auth/user-schemas"

type ActionResult = { error?: string }

// Server Actions de la gestion des utilisateurs (future page
// /administration/utilisateurs). Comme src/app/actions/roles.ts : la
// permission `user:*` correspondante est revérifiée côté serveur, la
// logique métier (garde-fous anti-verrouillage, dernier administrateur,
// etc.) vit dans src/lib/auth/users.ts et src/lib/auth/create-user.ts, et
// leurs erreurs françaises sont relayées telles quelles.

export async function createUserAction(values: CreateUserInput): Promise<ActionResult> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return { error: "Vous devez être connecté pour effectuer cette action." }
  }

  try {
    await requirePermission(session.user, "user", "create")

    const parsed = createUserSchema.safeParse(values)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Utilisateur invalide." }
    }

    await createUserWithPassword({ ...parsed.data, actorId: session.user.id })
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Une erreur est survenue." }
  }

  return {}
}

export async function updateUserAction(
  id: string,
  values: UpdateUserInput,
): Promise<ActionResult> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return { error: "Vous devez être connecté pour effectuer cette action." }
  }

  try {
    await requirePermission(session.user, "user", "update")

    const parsed = updateUserSchema.safeParse(values)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Utilisateur invalide." }
    }

    await updateUser(session.user.id, id, parsed.data)
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Une erreur est survenue." }
  }

  return {}
}

export async function deleteUserAction(id: string): Promise<ActionResult> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return { error: "Vous devez être connecté pour effectuer cette action." }
  }

  try {
    await requirePermission(session.user, "user", "delete")
    await deleteUser(session.user.id, id)
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Une erreur est survenue." }
  }

  return {}
}
