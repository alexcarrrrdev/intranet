import { z } from "zod"

// Schémas Zod de la gestion des utilisateurs (page
// /administration/utilisateurs), partagés entre le client et le serveur
// (Server Actions dans src/app/actions/users.ts), comme les autres schémas
// de src/lib/auth/.
//
// Validation volontairement structurelle : l'existence du rôle et les
// garde-fous métier (auto-modification de son propre rôle, dernier
// administrateur, etc.) sont vérifiés dans src/lib/auth/create-user.ts et
// src/lib/auth/users.ts, pas ici.

export const createUserSchema = z.object({
  name: z.string().trim().min(1, { error: "Le nom est requis." }),
  email: z.email({ error: "Entrez un courriel valide." }),
  password: z
    .string()
    .min(8, { error: "Le mot de passe doit contenir au moins 8 caractères." }),
  role: z.string().trim().min(1, { error: "Le rôle est requis." }),
})

export type CreateUserInput = z.infer<typeof createUserSchema>

export const updateUserSchema = z.object({
  name: z.string().trim().min(1, { error: "Le nom est requis." }).optional(),
  role: z.string().trim().min(1, { error: "Le rôle est requis." }).optional(),
})

export type UpdateUserInput = z.infer<typeof updateUserSchema>
