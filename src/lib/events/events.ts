/**
 * Logique du calendrier (/calendrier — voir `event` dans src/db/schema.ts).
 * Création/suppression protégées par `event:manage` (vérifié dans
 * src/app/actions/events.ts, jamais ici) ; lecture ouverte à tout
 * utilisateur connecté.
 */
import { randomUUID } from "node:crypto"
import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm"

import { db } from "@/db"
import { event, eventRsvp } from "@/db/schema"
import { recordAudit, resolveActorLabel } from "@/lib/audit/audit"

export type EventListItem = {
  id: string
  title: string
  description: string | null
  location: string | null
  startsAt: Date
  endsAt: Date | null
  allDay: boolean
  // Date de création de l'événement (distincte de `startsAt`) — utilisée par
  // le tri du fil unifié (/fil), voir src/lib/feed/merge-feed-items.ts.
  createdAt: Date
  // Nombre de participants ("going") et réponse de l'utilisateur courant —
  // renseignés uniquement quand `currentUserId` est fourni à
  // listUpcomingEvents/listPastEvents (voir ci-dessous), sinon `0`/`null`.
  goingCount: number
  myRsvp: "going" | "declined" | null
}

/**
 * Enrichit une liste d'événements avec le compte de participants et la
 * réponse de `currentUserId`, en deux requêtes groupées (pas une par
 * événement) — voir EventListItem.
 */
async function withRsvpInfo(
  rows: Omit<EventListItem, "goingCount" | "myRsvp">[],
  currentUserId?: string,
): Promise<EventListItem[]> {
  if (rows.length === 0) return []
  const eventIds = rows.map((row) => row.id)

  const [goingRows, myRows] = await Promise.all([
    db
      .select({ eventId: eventRsvp.eventId })
      .from(eventRsvp)
      .where(and(inArray(eventRsvp.eventId, eventIds), eq(eventRsvp.status, "going"))),
    currentUserId
      ? db
          .select({ eventId: eventRsvp.eventId, status: eventRsvp.status })
          .from(eventRsvp)
          .where(and(inArray(eventRsvp.eventId, eventIds), eq(eventRsvp.userId, currentUserId)))
      : Promise.resolve([]),
  ])

  const goingCountByEvent = new Map<string, number>()
  for (const row of goingRows) {
    goingCountByEvent.set(row.eventId, (goingCountByEvent.get(row.eventId) ?? 0) + 1)
  }
  const myRsvpByEvent = new Map(myRows.map((row) => [row.eventId, row.status]))

  return rows.map((row) => ({
    ...row,
    goingCount: goingCountByEvent.get(row.id) ?? 0,
    myRsvp: (myRsvpByEvent.get(row.id) as "going" | "declined" | undefined) ?? null,
  }))
}

/**
 * Événements à venir (startsAt >= début de la journée courante), triés du
 * plus proche au plus lointain — voir /calendrier, groupés par mois côté
 * page. `currentUserId` optionnel : renseigne `goingCount`/`myRsvp` de
 * chaque événement (voir withRsvpInfo).
 */
export async function listUpcomingEvents(currentUserId?: string): Promise<EventListItem[]> {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const rows = await db
    .select({
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.location,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      allDay: event.allDay,
      createdAt: event.createdAt,
    })
    .from(event)
    .where(gte(event.startsAt, startOfToday))
    .orderBy(asc(event.startsAt))

  return withRsvpInfo(rows, currentUserId)
}

/**
 * Événements passés (startsAt < début de la journée courante), les plus
 * récents en premier — section repliée « Événements passés » de
 * /calendrier.
 */
export async function listPastEvents(currentUserId?: string): Promise<EventListItem[]> {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const rows = await db
    .select({
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.location,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      allDay: event.allDay,
      createdAt: event.createdAt,
    })
    .from(event)
    .where(lt(event.startsAt, startOfToday))
    .orderBy(desc(event.startsAt))

  return withRsvpInfo(rows, currentUserId)
}

export type EventDetail = EventListItem

/** Détail d'un événement pour /fil?evenement=…, ou `null` si introuvable. */
export async function getEventDetail(
  eventId: string,
  currentUserId: string,
): Promise<EventDetail | null> {
  const [row] = await db
    .select({
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.location,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      allDay: event.allDay,
      createdAt: event.createdAt,
    })
    .from(event)
    .where(eq(event.id, eventId))
    .limit(1)

  if (!row) return null

  const [enriched] = await withRsvpInfo([row], currentUserId)
  return enriched
}

export async function createEvent(params: {
  actorId: string
  title: string
  description?: string
  location?: string
  startsAt: Date
  endsAt?: Date
  allDay: boolean
}): Promise<void> {
  await db.transaction(async (tx) => {
    const id = randomUUID()
    await tx.insert(event).values({
      id,
      title: params.title,
      description: params.description ?? null,
      location: params.location ?? null,
      startsAt: params.startsAt,
      endsAt: params.endsAt ?? null,
      allDay: params.allDay,
      createdBy: params.actorId,
    })
    const actorLabel = await resolveActorLabel(tx, params.actorId)
    await recordAudit(tx, {
      actorId: params.actorId,
      actorLabel,
      action: "event.create",
      targetType: "event",
      targetId: id,
      targetLabel: params.title,
    })
  })
}

export async function deleteEvent(params: { actorId: string; eventId: string }): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ title: event.title })
      .from(event)
      .where(eq(event.id, params.eventId))
      .limit(1)

    await tx.delete(event).where(eq(event.id, params.eventId))

    const actorLabel = await resolveActorLabel(tx, params.actorId)
    await recordAudit(tx, {
      actorId: params.actorId,
      actorLabel,
      action: "event.delete",
      targetType: "event",
      targetId: params.eventId,
      targetLabel: row?.title ?? "",
    })
  })
}
