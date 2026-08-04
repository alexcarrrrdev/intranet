"use server"

import { headers } from "next/headers"
import { refresh } from "next/cache"

import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/auth/permissions"
import { createGroup, deleteGroup, joinGroup, leaveGroup } from "@/lib/groups/groups"
import { createGroupSchema, groupIdSchema } from "@/lib/groups/schemas"

type ActionResult = { error?: string }

async function requireSession() {
  return auth.api.getSession({ headers: await headers() })
}

async function requireManageSession() {
  const session = await requireSession()
  if (!session || !(await hasPermission(session.user, "group", "manage"))) {
    return null
  }
  return session
}

export async function createGroupAction(values: unknown): Promise<ActionResult> {
  const session = await requireManageSession()
  if (!session) {
    return { error: "Vous n'avez pas la permission de créer un groupe." }
  }

  const parsed = createGroupSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Groupe invalide." }
  }

  try {
    await createGroup({
      actorId: session.user.id,
      name: parsed.data.name,
      description: parsed.data.description,
    })
  } catch {
    return { error: "Une erreur est survenue lors de la création." }
  }

  refresh()
  return {}
}

export async function deleteGroupAction(values: unknown): Promise<ActionResult> {
  const session = await requireManageSession()
  if (!session) {
    return { error: "Vous n'avez pas la permission de gérer les groupes." }
  }

  const parsed = groupIdSchema.safeParse(values)
  if (!parsed.success) return { error: "Groupe invalide." }

  try {
    await deleteGroup({ actorId: session.user.id, groupId: parsed.data.groupId })
  } catch {
    return { error: "Une erreur est survenue lors de la suppression." }
  }

  refresh()
  return {}
}

// Rejoindre/quitter un groupe : ouvert à tout utilisateur connecté (groupes
// ouverts, v1), pas de permission `group:manage` requise ici — voir le
// commentaire de `groupMember` dans src/db/schema.ts.
export async function joinGroupAction(values: unknown): Promise<ActionResult> {
  const session = await requireSession()
  if (!session) return { error: "Vous devez être connecté." }

  const parsed = groupIdSchema.safeParse(values)
  if (!parsed.success) return { error: "Groupe invalide." }

  try {
    await joinGroup(parsed.data.groupId, session.user.id)
  } catch {
    return { error: "Une erreur est survenue." }
  }

  refresh()
  return {}
}

export async function leaveGroupAction(values: unknown): Promise<ActionResult> {
  const session = await requireSession()
  if (!session) return { error: "Vous devez être connecté." }

  const parsed = groupIdSchema.safeParse(values)
  if (!parsed.success) return { error: "Groupe invalide." }

  try {
    await leaveGroup(parsed.data.groupId, session.user.id)
  } catch {
    return { error: "Une erreur est survenue." }
  }

  refresh()
  return {}
}
