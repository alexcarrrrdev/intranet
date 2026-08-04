import { z } from "zod"

// Schémas Zod de la gestion des rôles (page /administration/utilisateurs,
// onglet Rôles — phase UI à venir), partagés entre le client et le serveur
// (Server Actions dans src/app/actions/roles.ts), comme les autres schémas
// de src/lib/auth/.
//
// Validation volontairement structurelle (formes, longueurs, motif de
// l'identifiant) : les règles MÉTIER (permissions inconnues, rôles système
// protégés, rôle encore utilisé, etc.) sont appliquées dans
// src/lib/auth/roles.ts, pas ici — voir son commentaire d'en-tête.

const roleNameSchema = z
  .string()
  .trim()
  .min(1, { error: "Le nom du rôle est requis." })
  .max(100, { error: "Le nom du rôle est trop long (100 caractères maximum)." })

const roleDescriptionSchema = z
  .string()
  .trim()
  .max(500, { error: "La description est trop longue (500 caractères maximum)." })
  .optional()

const rolePermissionsSchema = z
  .array(z.string())
  .default([])

export const createRoleSchema = z.object({
  // Identifiant facultatif : dérivé du nom par src/lib/auth/roles.ts quand
  // absent. Chaîne vide traitée comme absente (formulaire non renseigné).
  id: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{2,50}$/, {
      error:
        "L'identifiant doit contenir entre 2 et 50 caractères : lettres minuscules, chiffres et tirets uniquement.",
    })
    .optional()
    .or(z.literal("")),
  name: roleNameSchema,
  description: roleDescriptionSchema,
  permissions: rolePermissionsSchema,
})

export type CreateRoleInput = z.infer<typeof createRoleSchema>

export const updateRoleSchema = z.object({
  name: roleNameSchema,
  description: roleDescriptionSchema,
  permissions: rolePermissionsSchema,
})

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>
