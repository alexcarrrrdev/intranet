/**
 * Schémas Zod des annonces (/annonces), validés côté client (dialog de
 * création) et revalidés côté serveur (src/app/actions/announcements.ts).
 */
import { z } from "zod"

export const createAnnouncementSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { error: "Le titre est requis." })
    .max(200, { error: "Le titre est trop long (200 caractères maximum)." }),
  body: z
    .string()
    .trim()
    .min(1, { error: "Le contenu est requis." })
    .max(4000, { error: "Le contenu est trop long (4000 caractères maximum)." }),
})
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>

export const announcementIdSchema = z.object({ announcementId: z.string().min(1) })
export type AnnouncementIdInput = z.infer<typeof announcementIdSchema>

export const setPinnedSchema = z.object({
  announcementId: z.string().min(1),
  pinned: z.boolean(),
})
export type SetPinnedInput = z.infer<typeof setPinnedSchema>
