/**
 * Logique des groupes (/groupes, /groupes/[id] — voir `intranet_group`,
 * `group_member` et `group_invitation` dans src/db/schema.ts).
 * Création/suppression protégées par `group:manage` (vérifié dans
 * src/app/actions/groups.ts, jamais ici) ; rejoindre un groupe se fait
 * désormais uniquement sur invitation (voir acceptInvitation/
 * declineInvitation/inviteToGroup ci-dessous) — quitter reste ouvert et
 * idempotent.
 */
import { randomUUID } from "node:crypto"
import { and, count, eq, isNull, notInArray } from "drizzle-orm"

import { db } from "@/db"
import { groupInvitation, groupMember, intranetGroup, user } from "@/db/schema"
import { recordAudit, resolveActorLabel } from "@/lib/audit/audit"

export type GroupMemberAvatar = { id: string; name: string; image: string | null }

export type GroupListItem = {
  id: string
  name: string
  description: string | null
  memberCount: number
  // Jusqu'à 5 avatars empilés (voir le plan produit) — pas la liste
  // complète des membres.
  previewMembers: GroupMemberAvatar[]
  isMember: boolean
  // Invitation en attente pour l'utilisateur courant (voir
  // group_invitation dans src/db/schema.ts) — permet à l'interface
  // d'afficher un bandeau d'acceptation plutôt que le groupe verrouillé.
  isInvited: boolean
}

const AVATAR_PREVIEW_LIMIT = 5

/**
 * Liste les groupes avec leur nombre de membres, un aperçu de membres
 * (jusqu'à 5, pour les avatars empilés) et si `currentUserId` en fait
 * partie — pour /groupes. Une requête par groupe pour l'aperçu de membres
 * serait acceptable ici (nombre de groupes attendu faible dans ce
 * contexte), gardé simple plutôt qu'une agrégation SQL complexe.
 */
export async function listGroups(currentUserId: string): Promise<GroupListItem[]> {
  const groups = await db
    .select({ id: intranetGroup.id, name: intranetGroup.name, description: intranetGroup.description })
    .from(intranetGroup)
    .orderBy(intranetGroup.name)

  if (groups.length === 0) return []

  // Invitations en attente de l'utilisateur courant, chargées une seule
  // fois plutôt qu'une requête par groupe (même esprit que le commentaire
  // de `listGroups` sur les avatars, mais ici le volume attendu — une
  // requête simple sur clé composite — ne justifie pas de la répéter).
  const myInvitations = await db
    .select({ groupId: groupInvitation.groupId })
    .from(groupInvitation)
    .where(eq(groupInvitation.userId, currentUserId))
  const invitedGroupIds = new Set(myInvitations.map((row) => row.groupId))

  const results: GroupListItem[] = []
  for (const group of groups) {
    const members = await db
      .select({ id: user.id, name: user.name, image: user.image })
      .from(groupMember)
      .innerJoin(user, eq(groupMember.userId, user.id))
      .where(eq(groupMember.groupId, group.id))
      .orderBy(groupMember.joinedAt)

    results.push({
      id: group.id,
      name: group.name,
      description: group.description,
      memberCount: members.length,
      previewMembers: members.slice(0, AVATAR_PREVIEW_LIMIT),
      isMember: members.some((member) => member.id === currentUserId),
      isInvited: invitedGroupIds.has(group.id),
    })
  }

  return results
}

export type GroupDetail = {
  id: string
  name: string
  description: string | null
  memberCount: number
  isMember: boolean
  // Invitation en attente pour l'utilisateur courant, avec le nom de la
  // personne qui l'a invité (affiché dans le bandeau d'invitation) — `null`
  // si aucune invitation en attente.
  invitation: { invitedByName: string } | null
}

/** Détail d'un groupe pour /groupes/[id], ou `null` si introuvable (404). */
export async function getGroupDetail(
  groupId: string,
  currentUserId: string,
): Promise<GroupDetail | null> {
  const [group] = await db
    .select({ id: intranetGroup.id, name: intranetGroup.name, description: intranetGroup.description })
    .from(intranetGroup)
    .where(eq(intranetGroup.id, groupId))
    .limit(1)

  if (!group) return null

  const [{ value: memberCount }] = await db
    .select({ value: count() })
    .from(groupMember)
    .where(eq(groupMember.groupId, groupId))

  const [membership] = await db
    .select({ userId: groupMember.userId })
    .from(groupMember)
    .where(and(eq(groupMember.groupId, groupId), eq(groupMember.userId, currentUserId)))
    .limit(1)

  const [invitation] = await db
    .select({ invitedByName: user.name })
    .from(groupInvitation)
    .innerJoin(user, eq(groupInvitation.invitedBy, user.id))
    .where(and(eq(groupInvitation.groupId, groupId), eq(groupInvitation.userId, currentUserId)))
    .limit(1)

  return {
    id: group.id,
    name: group.name,
    description: group.description,
    memberCount,
    isMember: Boolean(membership),
    invitation: invitation ? { invitedByName: invitation.invitedByName } : null,
  }
}

// Note : la vérification « poster dans un groupe requiert d'en être
// membre » vit déjà dans src/lib/feed/posts.ts (isGroupMember), utilisée
// par src/app/actions/feed.ts — pas dupliquée ici pour rester la seule
// source de vérité de cette règle.

export async function createGroup(params: {
  actorId: string
  name: string
  description?: string
}): Promise<void> {
  await db.transaction(async (tx) => {
    const id = randomUUID()
    await tx.insert(intranetGroup).values({
      id,
      name: params.name,
      description: params.description ?? null,
      createdBy: params.actorId,
    })
    // Le créateur devient automatiquement membre : sinon il ne verrait pas
    // le composeur du fil de groupe qu'il vient de créer sans re-rejoindre
    // manuellement.
    await tx.insert(groupMember).values({ groupId: id, userId: params.actorId })

    const actorLabel = await resolveActorLabel(tx, params.actorId)
    await recordAudit(tx, {
      actorId: params.actorId,
      actorLabel,
      action: "group.create",
      targetType: "group",
      targetId: id,
      targetLabel: params.name,
    })
  })
}

export async function deleteGroup(params: { actorId: string; groupId: string }): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ name: intranetGroup.name })
      .from(intranetGroup)
      .where(eq(intranetGroup.id, params.groupId))
      .limit(1)

    await tx.delete(intranetGroup).where(eq(intranetGroup.id, params.groupId))

    const actorLabel = await resolveActorLabel(tx, params.actorId)
    await recordAudit(tx, {
      actorId: params.actorId,
      actorLabel,
      action: "group.delete",
      targetType: "group",
      targetId: params.groupId,
      targetLabel: row?.name ?? "",
    })
  })
}

/** Quitter un groupe : idempotent, aucune erreur si pas membre. */
export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  await db
    .delete(groupMember)
    .where(and(eq(groupMember.groupId, groupId), eq(groupMember.userId, userId)))
}

/**
 * Invite un utilisateur à rejoindre un groupe. Idempotent : n'insère rien
 * (sans erreur) si l'invitation existe déjà — `onConflictDoNothing` sur la
 * clé composite (groupId, userId). Ne vérifie PAS l'appartenance de
 * l'invité au groupe : c'est à l'appelant (inviteToGroupAction) de refuser
 * doucement ce cas avant d'appeler cette fonction, pour renvoyer un message
 * distinct de « déjà invité ».
 */
export async function inviteToGroup(params: {
  groupId: string
  userId: string
  invitedBy: string
}): Promise<void> {
  await db
    .insert(groupInvitation)
    .values({ groupId: params.groupId, userId: params.userId, invitedBy: params.invitedBy })
    .onConflictDoNothing()

  const actorLabel = await resolveActorLabel(db, params.invitedBy)
  const [invitee] = await db
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, params.userId))
    .limit(1)
  await recordAudit(db, {
    actorId: params.invitedBy,
    actorLabel,
    action: "group.invite",
    targetType: "group",
    targetId: params.groupId,
    targetLabel: invitee ? `${invitee.name} (${invitee.email})` : "",
  })
}

/** Vérifie qu'un utilisateur est déjà membre du groupe donné. */
export async function isGroupMember(groupId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: groupMember.userId })
    .from(groupMember)
    .where(and(eq(groupMember.groupId, groupId), eq(groupMember.userId, userId)))
    .limit(1)
  return Boolean(row)
}

/** Vérifie qu'une invitation en attente existe pour (groupId, userId). */
export async function hasInvitation(groupId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: groupInvitation.userId })
    .from(groupInvitation)
    .where(and(eq(groupInvitation.groupId, groupId), eq(groupInvitation.userId, userId)))
    .limit(1)
  return Boolean(row)
}

/**
 * Accepte une invitation en attente : crée l'appartenance et supprime
 * l'invitation, dans la même transaction — ni l'une ni l'autre ne doit se
 * produire sans l'autre. Ne fait rien si aucune invitation n'existe (voir
 * acceptInvitationAction, qui vérifie ce cas en amont et retourne une
 * erreur douce à l'utilisateur).
 */
export async function acceptInvitation(groupId: string, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(groupMember).values({ groupId, userId }).onConflictDoNothing()
    await tx
      .delete(groupInvitation)
      .where(and(eq(groupInvitation.groupId, groupId), eq(groupInvitation.userId, userId)))
  })
}

/** Refuse une invitation en attente : supprime simplement la ligne, idempotent. */
export async function declineInvitation(groupId: string, userId: string): Promise<void> {
  await db
    .delete(groupInvitation)
    .where(and(eq(groupInvitation.groupId, groupId), eq(groupInvitation.userId, userId)))
}

export type PendingInvitation = {
  groupId: string
  groupName: string
  invitedByName: string
  createdAt: Date
}

/** Liste les invitations en attente d'un utilisateur, pour le rail gauche de /fil. */
export async function listMyInvitations(userId: string): Promise<PendingInvitation[]> {
  const invitedBy = user
  const rows = await db
    .select({
      groupId: groupInvitation.groupId,
      groupName: intranetGroup.name,
      invitedByName: invitedBy.name,
      createdAt: groupInvitation.createdAt,
    })
    .from(groupInvitation)
    .innerJoin(intranetGroup, eq(groupInvitation.groupId, intranetGroup.id))
    .innerJoin(invitedBy, eq(groupInvitation.invitedBy, invitedBy.id))
    .where(eq(groupInvitation.userId, userId))
    .orderBy(groupInvitation.createdAt)

  return rows
}

export type InvitableUser = { id: string; name: string; email: string; image: string | null }

/**
 * Liste les employés actifs (non supprimés) qui ne sont NI membres du
 * groupe NI déjà invités — pour peupler le sélecteur du dialog
 * d'invitation (voir src/components/groups/group-detail-header.tsx).
 */
export async function listGroupInvitees(groupId: string): Promise<InvitableUser[]> {
  const excludedRows = await db
    .select({ userId: groupMember.userId })
    .from(groupMember)
    .where(eq(groupMember.groupId, groupId))
  const invitedRows = await db
    .select({ userId: groupInvitation.userId })
    .from(groupInvitation)
    .where(eq(groupInvitation.groupId, groupId))

  const excludedIds = [
    ...excludedRows.map((row) => row.userId),
    ...invitedRows.map((row) => row.userId),
  ]

  const conditions = [isNull(user.deletedAt)]
  if (excludedIds.length > 0) conditions.push(notInArray(user.id, excludedIds))

  return db
    .select({ id: user.id, name: user.name, email: user.email, image: user.image })
    .from(user)
    .where(and(...conditions))
    .orderBy(user.name)
}
