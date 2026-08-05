/**
 * Schémas Zod du calendrier (/calendrier), validés côté client (dialog de
 * création) et revalidés côté serveur (src/app/actions/events.ts).
 */
import { z } from "zod"

// Les champs date/heure arrivent du formulaire sous forme de chaînes ISO
// (voir new-event-dialog.tsx, `<input type="datetime-local">` /
// `type="date"`) — `z.coerce.date()` les convertit et rejette toute valeur
// non parseable.
export const createEventSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, { error: "Le titre est requis." })
      .max(200, { error: "Le titre est trop long (200 caractères maximum)." }),
    description: z
      .string()
      .trim()
      .max(4000, { error: "La description est trop longue (4000 caractères maximum)." })
      .optional()
      .transform((value) => (value ? value : undefined)),
    location: z
      .string()
      .trim()
      .max(200, { error: "Le lieu est trop long (200 caractères maximum)." })
      .optional()
      .transform((value) => (value ? value : undefined)),
    startsAt: z.coerce.date({ error: "La date de début est requise." }),
    endsAt: z.coerce.date({ error: "Date de fin invalide." }).optional(),
    allDay: z.boolean(),
  })
  .refine((value) => !value.endsAt || value.endsAt >= value.startsAt, {
    error: "La date de fin doit être après la date de début.",
    path: ["endsAt"],
  })
export type CreateEventInput = z.infer<typeof createEventSchema>

export const eventIdSchema = z.object({ eventId: z.string().min(1) })
export type EventIdInput = z.infer<typeof eventIdSchema>

// Réponse à un événement (RSVP, /fil?evenement=… et /calendrier) : ouvert à
// tout utilisateur connecté (voir src/app/actions/events.ts, rsvpAction).
export const setRsvpSchema = z.object({
  eventId: z.string().min(1),
  status: z.enum(["going", "declined"]),
})
export type SetRsvpInput = z.infer<typeof setRsvpSchema>
