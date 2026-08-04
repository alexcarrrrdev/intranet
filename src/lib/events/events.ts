/**
 * Logique du calendrier (/calendrier — voir `event` dans src/db/schema.ts).
 * Création/suppression protégées par `event:manage` (vérifié dans
 * src/app/actions/events.ts, jamais ici) ; lecture ouverte à tout
 * utilisateur connecté.
 */
import { randomUUID } from "node:crypto"
import { asc, desc, eq, gte, lt } from "drizzle-orm"

import { db } from "@/db"
import { event } from "@/db/schema"
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
}

/**
 * Événements à venir (startsAt >= début de la journée courante), triés du
 * plus proche au plus lointain — voir /calendrier, groupés par mois côté
 * page.
 */
export async function listUpcomingEvents(): Promise<EventListItem[]> {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  return db
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
}

/**
 * Événements passés (startsAt < début de la journée courante), les plus
 * récents en premier — section repliée « Événements passés » de
 * /calendrier.
 */
export async function listPastEvents(): Promise<EventListItem[]> {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  return db
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
