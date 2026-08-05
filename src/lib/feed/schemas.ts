/**
 * Schémas Zod du fil (/fil et /groupes/[id], mêmes composants — voir
 * src/components/feed). Validés côté client (formulaires) ET revalidés
 * côté serveur dans chaque Server Action (src/app/actions/feed.ts), jamais
 * l'un sans l'autre.
 */
import { z } from "zod"

// Ensemble FERMÉ d'emojis de réaction acceptés — voir `post_reaction` dans
// src/db/schema.ts. Toute valeur hors de cette liste est refusée côté
// serveur, même si un appelant contournait le formulaire (ex. requête
// forgée).
export const REACTION_EMOJIS = ["👍", "❤️", "🎉", "👏", "😂"] as const
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number]

const bodySchema = z
  .string()
  .trim()
  .min(1, { error: "Le message ne peut pas être vide." })
  .max(2000, { error: "Le message est trop long (2000 caractères maximum)." })

const commentBodySchema = z
  .string()
  .trim()
  .min(1, { error: "Le commentaire ne peut pas être vide." })
  .max(1000, { error: "Le commentaire est trop long (1000 caractères maximum)." })

const groupIdSchema = z.string().nullable().optional()
const eventIdSchema = z.string().nullable().optional()

// Un post appartient à UN SEUL contexte — général, groupe OU événement,
// jamais deux à la fois (voir le commentaire de `post` dans
// src/db/schema.ts) : ce refine rejette toute soumission où `groupId` ET
// `eventId` seraient renseignés en même temps.
const exclusiveContext = <T extends { groupId?: string | null; eventId?: string | null }>(
  value: T,
) => !(value.groupId && value.eventId)
const exclusiveContextError = {
  error: "Une publication ne peut appartenir qu'à un seul contexte (général, groupe ou événement).",
  path: ["eventId"] as PropertyKey[],
}

export const createMessagePostSchema = z
  .object({
    groupId: groupIdSchema,
    eventId: eventIdSchema,
    body: bodySchema,
  })
  .refine(exclusiveContext, exclusiveContextError)
export type CreateMessagePostInput = z.infer<typeof createMessagePostSchema>

export const createKudosPostSchema = z
  .object({
    groupId: groupIdSchema,
    eventId: eventIdSchema,
    body: bodySchema,
    kudosRecipientId: z.string().min(1, { error: "Choisissez un destinataire." }),
  })
  .refine(exclusiveContext, exclusiveContextError)
export type CreateKudosPostInput = z.infer<typeof createKudosPostSchema>

export const createPollPostSchema = z
  .object({
    groupId: groupIdSchema,
    eventId: eventIdSchema,
    body: bodySchema,
    options: z
      .array(
        z
          .string()
          .trim()
          .min(1, { error: "Une option ne peut pas être vide." })
          .max(200, { error: "Une option est trop longue (200 caractères maximum)." }),
      )
      .min(2, { error: "Un sondage doit avoir au moins 2 options." })
      .max(5, { error: "Un sondage ne peut avoir plus de 5 options." }),
  })
  .refine(exclusiveContext, exclusiveContextError)
export type CreatePollPostInput = z.infer<typeof createPollPostSchema>

export const addCommentSchema = z.object({
  postId: z.string().min(1),
  body: commentBodySchema,
})
export type AddCommentInput = z.infer<typeof addCommentSchema>

export const setReactionSchema = z.object({
  postId: z.string().min(1),
  emoji: z.enum(REACTION_EMOJIS),
})
export type SetReactionInput = z.infer<typeof setReactionSchema>

export const votePollSchema = z.object({
  postId: z.string().min(1),
  optionId: z.string().min(1),
})
export type VotePollInput = z.infer<typeof votePollSchema>

export const deletePostSchema = z.object({ postId: z.string().min(1) })
export const deleteCommentSchema = z.object({ commentId: z.string().min(1) })
