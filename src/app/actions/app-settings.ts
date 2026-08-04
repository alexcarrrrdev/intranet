"use server"

import { headers } from "next/headers"
import { refresh } from "next/cache"

import { auth } from "@/lib/auth"
import {
  canManageAppSettings,
  clearLogo,
  clearPrimaryColor,
  setAppName,
  setLogo,
  setPrimaryColor,
} from "@/lib/settings/app-settings"
import { validateLogoFile } from "@/lib/settings/logo-validation"
import {
  updateAppNameSchema,
  updatePrimaryColorSchema,
  type UpdateAppNameInput,
  type UpdatePrimaryColorInput,
} from "@/lib/settings/schemas"

type ActionResult = { error?: string }

// Vérification de permission commune aux trois actions de ce fichier :
// refaite systématiquement côté serveur, jamais déduite de l'UI (voir la
// documentation en tête de chaque action ci-dessous).
async function requireAppSettingsSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || !(await canManageAppSettings(session.user))) {
    return null
  }
  return session
}

// Server Action de la page /administration/general. La vérification de
// permission est refaite ici même si le menu et la page filtrent déjà
// l'accès : cette action ne doit jamais se fier uniquement à l'UI.
export async function updateAppNameAction(
  values: UpdateAppNameInput,
): Promise<ActionResult> {
  const session = await requireAppSettingsSession()
  if (!session) {
    return {
      error: "Vous n'avez pas la permission de modifier ces paramètres.",
    }
  }

  const parsed = updateAppNameSchema.safeParse(values)
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Nom de l'application invalide.",
    }
  }

  try {
    await setAppName(session.user.id, parsed.data.appName)
  } catch {
    return { error: "Une erreur est survenue lors de l'enregistrement." }
  }

  return {}
}

// Server Action d'upload du logo. Reçoit un FormData (pas un objet
// typé/validé côté client) car c'est la façon standard d'envoyer un fichier
// à une Server Action — voir node_modules/next/dist/docs/01-app/02-guides/
// server-actions.md : « Validate inputs. Treat FormData [...] as untrusted. »
// La validation elle-même (taille, type MIME, signature binaire, liste noire
// SVG) est déléguée à validateLogoFile, testée indépendamment — voir
// src/lib/settings/logo-validation.test.ts.
export async function uploadLogoAction(formData: FormData): Promise<ActionResult> {
  const session = await requireAppSettingsSession()
  if (!session) {
    return {
      error: "Vous n'avez pas la permission de modifier ces paramètres.",
    }
  }

  const file = formData.get("logo")
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Aucun fichier n'a été sélectionné." }
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const validation = validateLogoFile(bytes, file.type)
  if (!validation.valid) {
    return { error: validation.error }
  }

  try {
    await setLogo(session.user.id, Buffer.from(bytes), file.type)
  } catch {
    return { error: "Une erreur est survenue lors de l'enregistrement du logo." }
  }

  return {}
}

// Server Action de retrait du logo : fait retomber l'application sur l'icône
// par défaut (voir src/components/brand-mark.tsx).
export async function removeLogoAction(): Promise<ActionResult> {
  const session = await requireAppSettingsSession()
  if (!session) {
    return {
      error: "Vous n'avez pas la permission de modifier ces paramètres.",
    }
  }

  try {
    await clearLogo(session.user.id)
  } catch {
    return { error: "Une erreur est survenue lors du retrait du logo." }
  }

  return {}
}

// Server Action de la carte « Couleur principale » de
// /administration/general. Même structure que updateAppNameAction : la
// validation Zod (format hexadécimal, voir updatePrimaryColorSchema et
// isValidHexColor dans src/lib/settings/color.ts) est refaite ici même si le
// formulaire (sélecteur de couleur natif + presets) ne peut normalement
// produire qu'une valeur déjà valide — jamais faire confiance uniquement à
// l'UI.
export async function updatePrimaryColorAction(
  values: UpdatePrimaryColorInput,
): Promise<ActionResult> {
  const session = await requireAppSettingsSession()
  if (!session) {
    return {
      error: "Vous n'avez pas la permission de modifier ces paramètres.",
    }
  }

  const parsed = updatePrimaryColorSchema.safeParse(values)
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Couleur invalide.",
    }
  }

  try {
    await setPrimaryColor(session.user.id, parsed.data.primaryColor)
  } catch {
    return { error: "Une erreur est survenue lors de l'enregistrement." }
  }

  // `refresh()` de `next/cache` (nouveau dans Next.js 16, voir
  // node_modules/next/dist/docs/01-app/03-api-reference/04-functions/
  // refresh.md) EN PLUS du `router.refresh()` côté client déjà appelé par
  // PrimaryColorForm après cette action : ce dernier suffit à rafraîchir la
  // page ET les layouts imbriqués (ex. la barre latérale, voir AppNameForm),
  // mais PAS le layout RACINE (src/app/layout.tsx) une fois qu'il a déjà été
  // monté — constaté empiriquement (E2E) : le <style> de thème qu'il injecte
  // restait bloqué sur l'ancienne couleur après un simple `router.refresh()`
  // côté client, alors qu'une navigation complète le montrait à jour.
  // Appeler `refresh()` ICI, depuis la Server Action elle-même, force aussi
  // ce layout racine à se ré-exécuter avec la nouvelle couleur — sans quoi
  // il aurait fallu un `location.reload()` complet (rejeté : le but même de
  // cette action est un rafraîchissement sans perte d'état côté client).
  refresh()

  return {}
}

// Server Action de réinitialisation de la couleur principale : fait
// retomber l'application sur le thème par défaut de globals.css (voir le
// bouton « Réinitialiser » dans
// src/components/administration/primary-color-form.tsx).
export async function resetPrimaryColorAction(): Promise<ActionResult> {
  const session = await requireAppSettingsSession()
  if (!session) {
    return {
      error: "Vous n'avez pas la permission de modifier ces paramètres.",
    }
  }

  try {
    await clearPrimaryColor(session.user.id)
  } catch {
    return {
      error: "Une erreur est survenue lors de la réinitialisation de la couleur.",
    }
  }

  // Voir le commentaire de `refresh()` dans updatePrimaryColorAction
  // ci-dessus : nécessaire pour le même layout racine, aussi bien pour un
  // retrait que pour un enregistrement.
  refresh()

  return {}
}
