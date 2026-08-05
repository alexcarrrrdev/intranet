/**
 * Participation à un événement (RSVP) — voir `event_rsvp` dans
 * src/db/schema.ts. Ouvert à tout utilisateur connecté, aucune permission
 * particulière (contrairement à la création/suppression de l'événement
 * lui-même, protégée par `event:manage`) — vérifié dans
 * src/app/actions/events.ts, jamais ici.
 */
import { and, eq } from "drizzle-orm"

import { db } from "@/db"
import { eventRsvp } from "@/db/schema"

export type RsvpStatus = "going" | "declined"

/**
 * Répond (ou change de réponse) à un événement : upsert idempotent — une
 * seconde réponse remplace la précédente plutôt que d'en créer une
 * deuxième (voir la clé composite de `event_rsvp`).
 */
export async function setRsvp(params: {
  eventId: string
  userId: string
  status: RsvpStatus
}): Promise<void> {
  await db
    .insert(eventRsvp)
    .values({ eventId: params.eventId, userId: params.userId, status: params.status })
    .onConflictDoUpdate({
      target: [eventRsvp.eventId, eventRsvp.userId],
      set: { status: params.status },
    })
}

/** Retire sa réponse (redevient "sans réponse") — idempotent. */
export async function removeRsvp(params: { eventId: string; userId: string }): Promise<void> {
  await db
    .delete(eventRsvp)
    .where(and(eq(eventRsvp.eventId, params.eventId), eq(eventRsvp.userId, params.userId)))
}

/** Nombre de participants ("going") d'un événement. */
export async function countGoing(eventId: string): Promise<number> {
  const rows = await db
    .select({ userId: eventRsvp.userId })
    .from(eventRsvp)
    .where(and(eq(eventRsvp.eventId, eventId), eq(eventRsvp.status, "going")))
  return rows.length
}

/** Réponse de `userId` à un événement, ou `null` si aucune. */
export async function myRsvp(params: {
  eventId: string
  userId: string
}): Promise<RsvpStatus | null> {
  const [row] = await db
    .select({ status: eventRsvp.status })
    .from(eventRsvp)
    .where(and(eq(eventRsvp.eventId, params.eventId), eq(eventRsvp.userId, params.userId)))
    .limit(1)
  return (row?.status as RsvpStatus | undefined) ?? null
}
