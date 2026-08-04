import { z } from "zod"

import { isValidHexColor } from "@/lib/settings/color"

// Schéma Zod des paramètres de l'application (page
// /administration/general), partagé entre le client et le serveur (Server
// Action dans src/app/actions/app-settings.ts).

export const updateAppNameSchema = z.object({
  appName: z
    .string()
    .trim()
    .min(1, { error: "Le nom de l'application est requis." })
    .max(100, {
      error: "Le nom de l'application est trop long (100 caractères maximum).",
    }),
})

export type UpdateAppNameInput = z.infer<typeof updateAppNameSchema>

// La validation de format proprement dite (isValidHexColor) vit dans
// src/lib/settings/color.ts, avec le reste des calculs de couleur — ce
// schéma ne fait que la brancher sur `.refine`, comme DATABASE_URL dans
// src/lib/env.ts.
export const updatePrimaryColorSchema = z.object({
  primaryColor: z.string().refine(isValidHexColor, {
    error: "La couleur doit être au format hexadécimal #RRGGBB.",
  }),
})

export type UpdatePrimaryColorInput = z.infer<typeof updatePrimaryColorSchema>
