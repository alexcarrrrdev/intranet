"use server"

import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { requirePermission } from "@/lib/auth/permissions"
import { createRole, deleteRole, updateRole } from "@/lib/auth/roles"
import {
  createRoleSchema,
  updateRoleSchema,
  type CreateRoleInput,
  type UpdateRoleInput,
} from "@/lib/auth/role-schemas"

type ActionResult = { error?: string }

// Server Actions de la gestion des rôles (future page
// /administration/utilisateurs). Chacune revérifie la permission `role:*`
// correspondante côté serveur — jamais déduite de l'UI, comme le reste des
// actions de ce dossier — puis délègue la logique métier (validation du
// catalogue de permissions, protections des rôles système, etc.) à
// src/lib/auth/roles.ts. Les erreurs levées par `requirePermission` et par
// les fonctions de src/lib/auth/roles.ts sont déjà des messages français
// prêts à être affichés : on les relaie tels quels.

export async function createRoleAction(values: CreateRoleInput): Promise<ActionResult> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return { error: "Vous devez être connecté pour effectuer cette action." }
  }

  try {
    await requirePermission(session.user, "role", "create")

    const parsed = createRoleSchema.safeParse(values)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Rôle invalide." }
    }

    await createRole(session.user.id, {
      id: parsed.data.id || undefined,
      name: parsed.data.name,
      description: parsed.data.description || null,
      permissions: parsed.data.permissions,
    })
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Une erreur est survenue." }
  }

  return {}
}

export async function updateRoleAction(
  id: string,
  values: UpdateRoleInput,
): Promise<ActionResult> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return { error: "Vous devez être connecté pour effectuer cette action." }
  }

  try {
    await requirePermission(session.user, "role", "update")

    const parsed = updateRoleSchema.safeParse(values)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Rôle invalide." }
    }

    await updateRole(session.user.id, id, {
      name: parsed.data.name,
      description: parsed.data.description || null,
      permissions: parsed.data.permissions,
    })
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Une erreur est survenue." }
  }

  return {}
}

export async function deleteRoleAction(id: string): Promise<ActionResult> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return { error: "Vous devez être connecté pour effectuer cette action." }
  }

  try {
    await requirePermission(session.user, "role", "delete")
    await deleteRole(session.user.id, id)
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Une erreur est survenue." }
  }

  return {}
}
