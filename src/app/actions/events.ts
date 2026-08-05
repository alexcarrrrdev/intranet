"use server"

import { headers } from "next/headers"
import { refresh } from "next/cache"

import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/auth/permissions"
import { createEvent, deleteEvent } from "@/lib/events/events"
import { createEventSchema, eventIdSchema, setRsvpSchema } from "@/lib/events/schemas"
import { setRsvp } from "@/lib/events/rsvp"

type ActionResult = { error?: string }

async function requireSession() {
  return auth.api.getSession({ headers: await headers() })
}

async function requireManageSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || !(await hasPermission(session.user, "event", "manage"))) {
    return null
  }
  return session
}

// Répondre à un événement (« Je participe » / « Je ne participe pas ») :
// ouvert à tout utilisateur connecté, aucune permission particulière —
// contrairement à la création/suppression de l'événement lui-même. Upsert
// idempotent (voir setRsvp, src/lib/events/rsvp.ts).
export async function rsvpAction(values: unknown): Promise<ActionResult> {
  const session = await requireSession()
  if (!session) return { error: "Vous devez être connecté." }

  const parsed = setRsvpSchema.safeParse(values)
  if (!parsed.success) return { error: "Réponse invalide." }

  try {
    await setRsvp({ eventId: parsed.data.eventId, userId: session.user.id, status: parsed.data.status })
  } catch {
    return { error: "Une erreur est survenue." }
  }

  refresh()
  return {}
}

export async function createEventAction(values: unknown): Promise<ActionResult> {
  const session = await requireManageSession()
  if (!session) {
    return { error: "Vous n'avez pas la permission de créer un événement." }
  }

  const parsed = createEventSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Événement invalide." }
  }

  try {
    await createEvent({
      actorId: session.user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      location: parsed.data.location,
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
      allDay: parsed.data.allDay,
    })
  } catch {
    return { error: "Une erreur est survenue lors de la création." }
  }

  refresh()
  return {}
}

export async function deleteEventAction(values: unknown): Promise<ActionResult> {
  const session = await requireManageSession()
  if (!session) {
    return { error: "Vous n'avez pas la permission de gérer les événements." }
  }

  const parsed = eventIdSchema.safeParse(values)
  if (!parsed.success) return { error: "Événement invalide." }

  try {
    await deleteEvent({ actorId: session.user.id, eventId: parsed.data.eventId })
  } catch {
    return { error: "Une erreur est survenue lors de la suppression." }
  }

  refresh()
  return {}
}
