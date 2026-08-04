import { z } from "zod"

// Schémas Zod partagés entre le client (validation immédiate dans le
// formulaire via react-hook-form) et le serveur (Server Actions dans
// src/app/actions/auth.ts). Un seul et même schéma valide les deux côtés.

export const loginSchema = z.object({
  email: z.email({ error: "Entrez un courriel valide." }),
  password: z.string().min(1, { error: "Le mot de passe est requis." }),
})

export type LoginInput = z.infer<typeof loginSchema>

export const forgotPasswordSchema = z.object({
  email: z.email({ error: "Entrez un courriel valide." }),
})

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, { error: "Le mot de passe doit contenir au moins 8 caractères." }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Les mots de passe ne correspondent pas.",
    path: ["confirmPassword"],
  })

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

// Schémas Zod du profil utilisateur (page /profil), partagés entre le
// client (validation immédiate dans le formulaire) et le serveur (Server
// Actions dans src/app/actions/profile.ts), comme les schémas
// d'authentification ci-dessus.

export const updateNameSchema = z.object({
  name: z.string().trim().min(1, { error: "Le nom est requis." }),
})

export type UpdateNameInput = z.infer<typeof updateNameSchema>

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, { error: "Le mot de passe actuel est requis." }),
    newPassword: z
      .string()
      .min(8, { error: "Le nouveau mot de passe doit contenir au moins 8 caractères." }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    error: "Les mots de passe ne correspondent pas.",
    path: ["confirmPassword"],
  })

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
