"use server"

import { headers } from "next/headers"
import { refresh } from "next/cache"

import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/auth/permissions"
import { createEvent, deleteEvent } from "@/lib/events/events"
import { createEventSchema, eventIdSchema } from "@/lib/events/schemas"

type ActionResult = { error?: string }

async function requireManageSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || !(await hasPermission(session.user, "event", "manage"))) {
    return null
  }
  return session
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
