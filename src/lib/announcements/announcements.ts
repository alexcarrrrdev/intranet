/**
 * Logique des annonces (/annonces — voir src/db/schema.ts pour `announcement`
 * et `announcement_read`). Création/épinglage/suppression protégés par
 * `announcement:manage` (vérifié dans src/app/actions/announcements.ts,
 * jamais ici) ; lecture et marquage « lu » ouverts à tout utilisateur
 * connecté.
 */
import { randomUUID } from "node:crypto"
import { and, desc, eq, inArray, isNull } from "drizzle-orm"

import { db } from "@/db"
import { announcement, announcementRead, user } from "@/db/schema"
import { recordAudit, resolveActorLabel } from "@/lib/audit/audit"

export type AnnouncementListItem = {
  id: string
  title: string
  body: string
  pinned: boolean
  createdAt: Date
  authorName: string
  isRead: boolean
  // Renseignés uniquement pour les détenteurs de `announcement:manage` (voir
  // listAnnouncements ci-dessous) : compteur « Lue par X/Y ».
  readCount: number | null
  totalUsers: number | null
}

/**
 * Nombre total d'utilisateurs actifs (exclut les comptes supprimés — voir
 * `deletedAt` dans src/db/schema.ts), dénominateur du compteur « Lue par
 * X/Y ».
 */
async function countActiveUsers(): Promise<number> {
  const rows = await db.select({ id: user.id }).from(user).where(isNull(user.deletedAt))
  return rows.length
}

/**
 * Liste les annonces, triées épinglées d'abord puis antéchronologique,
 * avec l'état lu/non-lu de `currentUserId`. Le compteur « Lue par X/Y »
 * n'est calculé que si `includeReadStats` est vrai (détenteurs de
 * `announcement:manage`, vérifié par l'appelant) — agrégé en une seule
 * requête groupée par annonce, pas une par ligne.
 */
export async function listAnnouncements(params: {
  currentUserId: string
  includeReadStats: boolean
}): Promise<AnnouncementListItem[]> {
  const rows = await db
    .select({
      id: announcement.id,
      title: announcement.title,
      body: announcement.body,
      pinned: announcement.pinned,
      createdAt: announcement.createdAt,
      authorName: user.name,
    })
    .from(announcement)
    .innerJoin(user, eq(announcement.authorId, user.id))
    .orderBy(desc(announcement.pinned), desc(announcement.createdAt))

  if (rows.length === 0) return []

  const ids = rows.map((row) => row.id)

  const myReads = await db
    .select({ announcementId: announcementRead.announcementId })
    .from(announcementRead)
    .where(
      and(inArray(announcementRead.announcementId, ids), eq(announcementRead.userId, params.currentUserId)),
    )
  const readByMe = new Set(myReads.map((row) => row.announcementId))

  const readCounts = new Map<string, number>()
  let totalUsers: number | null = null
  if (params.includeReadStats) {
    const allReads = await db
      .select({ announcementId: announcementRead.announcementId })
      .from(announcementRead)
      .where(inArray(announcementRead.announcementId, ids))
    for (const row of allReads) {
      readCounts.set(row.announcementId, (readCounts.get(row.announcementId) ?? 0) + 1)
    }
    totalUsers = await countActiveUsers()
  }

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    pinned: row.pinned,
    createdAt: row.createdAt,
    authorName: row.authorName,
    isRead: readByMe.has(row.id),
    readCount: params.includeReadStats ? (readCounts.get(row.id) ?? 0) : null,
    totalUsers,
  }))
}

/** Annonces épinglées, pour la petite carte en tête du fil (voir /fil). */
export async function listPinnedAnnouncements(): Promise<{ id: string; title: string }[]> {
  return db
    .select({ id: announcement.id, title: announcement.title })
    .from(announcement)
    .where(eq(announcement.pinned, true))
    .orderBy(desc(announcement.createdAt))
}

export type AnnouncementReader = { id: string; name: string; email: string }

/** Liste des personnes ayant lu une annonce (popover « Lue par », manage seulement). */
export async function getAnnouncementReaders(announcementId: string): Promise<AnnouncementReader[]> {
  return db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(announcementRead)
    .innerJoin(user, eq(announcementRead.userId, user.id))
    .where(eq(announcementRead.announcementId, announcementId))
    .orderBy(user.name)
}

/** Marquage « lu » explicite (bouton), idempotent — une seconde tentative ne fait rien. */
export async function markAnnouncementRead(announcementId: string, userId: string): Promise<void> {
  await db
    .insert(announcementRead)
    .values({ announcementId, userId })
    .onConflictDoNothing()
}

export async function createAnnouncement(params: {
  actorId: string
  title: string
  body: string
}): Promise<void> {
  await db.transaction(async (tx) => {
    const id = randomUUID()
    await tx.insert(announcement).values({
      id,
      authorId: params.actorId,
      title: params.title,
      body: params.body,
    })
    const actorLabel = await resolveActorLabel(tx, params.actorId)
    await recordAudit(tx, {
      actorId: params.actorId,
      actorLabel,
      action: "announcement.create",
      targetType: "announcement",
      targetId: id,
      targetLabel: params.title,
    })
  })
}

export async function setAnnouncementPinned(params: {
  actorId: string
  announcementId: string
  pinned: boolean
}): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ title: announcement.title })
      .from(announcement)
      .where(eq(announcement.id, params.announcementId))
      .limit(1)

    await tx
      .update(announcement)
      .set({ pinned: params.pinned })
      .where(eq(announcement.id, params.announcementId))

    const actorLabel = await resolveActorLabel(tx, params.actorId)
    await recordAudit(tx, {
      actorId: params.actorId,
      actorLabel,
      action: params.pinned ? "announcement.pin" : "announcement.unpin",
      targetType: "announcement",
      targetId: params.announcementId,
      targetLabel: row?.title ?? "",
    })
  })
}

export async function deleteAnnouncement(params: {
  actorId: string
  announcementId: string
}): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ title: announcement.title })
      .from(announcement)
      .where(eq(announcement.id, params.announcementId))
      .limit(1)

    await tx.delete(announcement).where(eq(announcement.id, params.announcementId))

    const actorLabel = await resolveActorLabel(tx, params.actorId)
    await recordAudit(tx, {
      actorId: params.actorId,
      actorLabel,
      action: "announcement.delete",
      targetType: "announcement",
      targetId: params.announcementId,
      targetLabel: row?.title ?? "",
    })
  })
}
