/**
 * Schémas Zod des groupes (/groupes), validés côté client (dialog de
 * création) et revalidés côté serveur (src/app/actions/groups.ts).
 */
import { z } from "zod"

export const createGroupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Le nom est requis." })
    .max(100, { error: "Le nom est trop long (100 caractères maximum)." }),
  description: z
    .string()
    .trim()
    .max(2000, { error: "La description est trop longue (2000 caractères maximum)." })
    .optional()
    .transform((value) => (value ? value : undefined)),
})
export type CreateGroupInput = z.infer<typeof createGroupSchema>

export const groupIdSchema = z.object({ groupId: z.string().min(1) })
export type GroupIdInput = z.infer<typeof groupIdSchema>

// Invitation d'un utilisateur à un groupe (inviteToGroupAction).
export const inviteToGroupSchema = z.object({
  groupId: z.string().min(1),
  userId: z.string().min(1),
})
export type InviteToGroupInput = z.infer<typeof inviteToGroupSchema>
