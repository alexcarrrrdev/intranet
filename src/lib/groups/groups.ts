/**
 * Logique des groupes (/groupes, /groupes/[id] — voir `intranet_group` et
 * `group_member` dans src/db/schema.ts). Création/suppression protégées par
 * `group:manage` (vérifié dans src/app/actions/groups.ts, jamais ici) ;
 * rejoindre/quitter ouvert à tout utilisateur connecté (groupes ouverts,
 * v1) et idempotent.
 */
import { randomUUID } from "node:crypto"
import { and, count, eq } from "drizzle-orm"

import { db } from "@/db"
import { groupMember, intranetGroup, user } from "@/db/schema"
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

  return {
    id: group.id,
    name: group.name,
    description: group.description,
    memberCount,
    isMember: Boolean(membership),
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

/** Rejoindre un groupe : idempotent, aucune erreur si déjà membre. */
export async function joinGroup(groupId: string, userId: string): Promise<void> {
  await db.insert(groupMember).values({ groupId, userId }).onConflictDoNothing()
}

/** Quitter un groupe : idempotent, aucune erreur si pas membre. */
export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  await db
    .delete(groupMember)
    .where(and(eq(groupMember.groupId, groupId), eq(groupMember.userId, userId)))
}
