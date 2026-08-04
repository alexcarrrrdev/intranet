"use server"

import { headers } from "next/headers"
import { refresh } from "next/cache"

import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/auth/permissions"
import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncementReaders,
  markAnnouncementRead,
  setAnnouncementPinned,
  type AnnouncementReader,
} from "@/lib/announcements/announcements"
import {
  announcementIdSchema,
  createAnnouncementSchema,
  setPinnedSchema,
} from "@/lib/announcements/schemas"

type ActionResult = { error?: string }

async function requireManageSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || !(await hasPermission(session.user, "announcement", "manage"))) {
    return null
  }
  return session
}

// Marquer une annonce comme lue : ouvert à tout utilisateur connecté,
// idempotent (voir markAnnouncementRead, onConflictDoNothing).
export async function markAnnouncementReadAction(values: unknown): Promise<ActionResult> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { error: "Vous devez être connecté." }

  const parsed = announcementIdSchema.safeParse(values)
  if (!parsed.success) return { error: "Annonce invalide." }

  try {
    await markAnnouncementRead(parsed.data.announcementId, session.user.id)
  } catch {
    return { error: "Une erreur est survenue." }
  }

  refresh()
  return {}
}

export async function createAnnouncementAction(values: unknown): Promise<ActionResult> {
  const session = await requireManageSession()
  if (!session) {
    return { error: "Vous n'avez pas la permission de créer une annonce." }
  }

  const parsed = createAnnouncementSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Annonce invalide." }
  }

  try {
    await createAnnouncement({
      actorId: session.user.id,
      title: parsed.data.title,
      body: parsed.data.body,
    })
  } catch {
    return { error: "Une erreur est survenue lors de la création." }
  }

  refresh()
  return {}
}

export async function setAnnouncementPinnedAction(values: unknown): Promise<ActionResult> {
  const session = await requireManageSession()
  if (!session) {
    return { error: "Vous n'avez pas la permission de gérer les annonces." }
  }

  const parsed = setPinnedSchema.safeParse(values)
  if (!parsed.success) return { error: "Annonce invalide." }

  try {
    await setAnnouncementPinned({
      actorId: session.user.id,
      announcementId: parsed.data.announcementId,
      pinned: parsed.data.pinned,
    })
  } catch {
    return { error: "Une erreur est survenue." }
  }

  refresh()
  return {}
}

export async function deleteAnnouncementAction(values: unknown): Promise<ActionResult> {
  const session = await requireManageSession()
  if (!session) {
    return { error: "Vous n'avez pas la permission de gérer les annonces." }
  }

  const parsed = announcementIdSchema.safeParse(values)
  if (!parsed.success) return { error: "Annonce invalide." }

  try {
    await deleteAnnouncement({ actorId: session.user.id, announcementId: parsed.data.announcementId })
  } catch {
    return { error: "Une erreur est survenue lors de la suppression." }
  }

  refresh()
  return {}
}

// Liste des personnes ayant lu une annonce (popover), réservée aux
// détenteurs de `announcement:manage` — lecture seule, pas de `refresh()`.
export async function getAnnouncementReadersAction(
  values: unknown,
): Promise<{ readers: AnnouncementReader[]; error?: string }> {
  const session = await requireManageSession()
  if (!session) return { readers: [], error: "Accès refusé." }

  const parsed = announcementIdSchema.safeParse(values)
  if (!parsed.success) return { readers: [], error: "Annonce invalide." }

  const readers = await getAnnouncementReaders(parsed.data.announcementId)
  return { readers }
}
