"use server"

import { headers } from "next/headers"
import { refresh } from "next/cache"

import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/auth/permissions"
import { getUser } from "@/lib/auth/users"
import {
  acceptInvitation,
  createGroup,
  declineInvitation,
  deleteGroup,
  hasInvitation,
  inviteToGroup,
  isGroupMember,
  leaveGroup,
} from "@/lib/groups/groups"
import { createGroupSchema, groupIdSchema, inviteToGroupSchema } from "@/lib/groups/schemas"

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

// Groupes sur invitation (v2) : on ne peut plus rejoindre librement — voir
// le commentaire de `intranet_group` dans src/db/schema.ts. Rejoindre passe
// désormais par acceptInvitationAction ci-dessous, toujours pour
// soi-même.
export async function inviteToGroupAction(values: unknown): Promise<ActionResult> {
  const session = await requireSession()
  if (!session) return { error: "Vous devez être connecté." }

  const parsed = inviteToGroupSchema.safeParse(values)
  if (!parsed.success) return { error: "Invitation invalide." }

  const { groupId, userId } = parsed.data

  // Réservé aux membres actuels du groupe, ou aux détenteurs de
  // `group:manage` (ex. un administrateur qui n'est pas encore membre).
  const canManage = await hasPermission(session.user, "group", "manage")
  if (!canManage) {
    const isMember = await isGroupMember(groupId, session.user.id)
    if (!isMember) {
      return { error: "Vous devez être membre de ce groupe pour y inviter quelqu'un." }
    }
  }

  const invitee = await getUser(userId)
  if (!invitee) {
    return { error: "Cet utilisateur est introuvable ou inactif." }
  }

  const alreadyMember = await isGroupMember(groupId, userId)
  if (alreadyMember) {
    return { error: "Cette personne est déjà membre du groupe." }
  }

  const alreadyInvited = await hasInvitation(groupId, userId)
  if (alreadyInvited) {
    return { error: "Cette personne a déjà été invitée." }
  }

  try {
    await inviteToGroup({ groupId, userId, invitedBy: session.user.id })
  } catch {
    return { error: "Une erreur est survenue lors de l'invitation." }
  }

  refresh()
  return {}
}

/** Accepter une invitation en attente, toujours pour soi-même. */
export async function acceptInvitationAction(values: unknown): Promise<ActionResult> {
  const session = await requireSession()
  if (!session) return { error: "Vous devez être connecté." }

  const parsed = groupIdSchema.safeParse(values)
  if (!parsed.success) return { error: "Groupe invalide." }

  const invited = await hasInvitation(parsed.data.groupId, session.user.id)
  if (!invited) {
    return { error: "Aucune invitation en attente pour ce groupe." }
  }

  try {
    await acceptInvitation(parsed.data.groupId, session.user.id)
  } catch {
    return { error: "Une erreur est survenue." }
  }

  refresh()
  return {}
}

/** Refuser une invitation en attente, toujours pour soi-même. */
export async function declineInvitationAction(values: unknown): Promise<ActionResult> {
  const session = await requireSession()
  if (!session) return { error: "Vous devez être connecté." }

  const parsed = groupIdSchema.safeParse(values)
  if (!parsed.success) return { error: "Groupe invalide." }

  try {
    await declineInvitation(parsed.data.groupId, session.user.id)
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
