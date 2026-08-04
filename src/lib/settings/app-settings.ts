import { cache } from "react"
import { eq } from "drizzle-orm"

import { db } from "@/db"
import { appSettings } from "@/db/schema"
import { hasPermission } from "@/lib/auth/permissions"
import { recordAudit, resolveActorLabel } from "@/lib/audit/audit"

// Nom de l'application par défaut, utilisé tant qu'aucun administrateur n'a
// enregistré de nom personnalisé (voir /administration/general).
export const DEFAULT_APP_NAME = "Admin Template"

// Identifiant fixe de l'unique rangée de app_settings : garantit qu'il ne
// peut jamais en exister plus d'une (voir src/db/schema.ts).
export const APP_SETTINGS_ID = "singleton"

/**
 * Résout le nom de l'application à partir de la rangée lue en base (ou son
 * absence). Extrait dans une fonction pure séparée de `getAppName` pour
 * pouvoir tester la logique de repli sans base de données.
 */
export function resolveAppName(row: { appName: string } | undefined | null): string {
  return row?.appName ?? DEFAULT_APP_NAME
}

/**
 * Résout la présence d'un logo à partir de la rangée lue en base. Un logo
 * est considéré présent si `logoMimeType` est renseigné — cette colonne est
 * toujours écrite/effacée en même temps que `logo` (voir setLogo/clearLogo
 * ci-dessous), donc la vérifier suffit sans avoir à lire les octets du logo
 * lui-même (voir getAppSettingsSummary, qui ne sélectionne jamais la colonne
 * `logo`).
 */
export function resolveHasLogo(
  row: { logoMimeType: string | null } | undefined | null,
): boolean {
  return row?.logoMimeType != null
}

/**
 * Résout la couleur principale personnalisée à partir de la rangée lue en
 * base (ou son absence). `null` tant qu'aucun administrateur n'en a
 * enregistré une (voir setPrimaryColor ci-dessous) — le thème par défaut de
 * globals.css s'applique alors sans aucune modification (voir
 * buildThemeCssVariables dans src/lib/settings/color.ts, et son injection
 * dans src/app/layout.tsx, qui ne rend rien du tout dans ce cas).
 */
export function resolvePrimaryColor(
  row: { primaryColor: string | null } | undefined | null,
): string | null {
  return row?.primaryColor ?? null
}

export type AppSettingsSummary = {
  appName: string
  hasLogo: boolean
  // Horodatage (ms epoch) de la dernière modification des paramètres,
  // utilisé comme paramètre de cache-busting (`/logo?v=...`) partout où le
  // logo est affiché : voir src/components/brand-mark.tsx. 0 tant qu'aucune
  // rangée n'existe encore.
  logoVersion: number
  // Couleur principale personnalisée (`#RRGGBB`), ou `null` si le thème par
  // défaut s'applique — voir resolvePrimaryColor ci-dessus.
  primaryColor: string | null
}

/**
 * Lit les paramètres de l'application nécessaires à leur AFFICHAGE (nom,
 * présence d'un logo, version de cache) en une seule requête.
 *
 * Mémorisé avec `cache()` de React : ces informations sont lues à plusieurs
 * endroits d'un même rendu (layout du tableau de bord, barre latérale, page
 * /administration/general, en-tête des pages publiques via
 * src/components/brand-header.tsx), et sans cette mémorisation chacun de ces
 * endroits déclencherait sa propre requête. `getAppName` et `hasLogo`
 * ci-dessous délèguent toutes deux à cette même fonction mémorisée : un
 * rendu qui appelle `getAppName()` PUIS `hasLogo()` ne coûte donc toujours
 * qu'UNE seule requête, pas deux.
 *
 * Sélectionne volontairement `logoMimeType` (texte, léger) et non `logo`
 * (bytea, potentiellement jusqu'à 1 Mo) : la plupart des rendus n'ont besoin
 * que de savoir SI un logo existe, pas de ses octets. Les octets ne sont lus
 * qu'à l'endroit qui en a réellement besoin, la route /logo (voir getLogo
 * ci-dessous), via sa propre requête mémorisée.
 *
 * Sélectionne aussi `primaryColor` (texte, léger comme `logoMimeType`) :
 * consommé par le layout racine (src/app/layout.tsx) pour l'injection
 * côté serveur du <style> de thème (voir buildThemeCssVariables dans
 * src/lib/settings/color.ts) — le même argument qu'au-dessus s'applique,
 * cette mémorisation garantit qu'une seule requête est faite même si
 * generateMetadata ET le layout lisent tous deux ces réglages pour un même
 * rendu.
 *
 * La mémorisation ne vaut que pour la durée d'une requête HTTP : une
 * écriture suivie d'un rafraîchissement (nouvelle requête) renvoie bien la
 * valeur à jour.
 */
export const getAppSettingsSummary = cache(
  async function getAppSettingsSummary(): Promise<AppSettingsSummary> {
    const [row] = await db
      .select({
        appName: appSettings.appName,
        logoMimeType: appSettings.logoMimeType,
        updatedAt: appSettings.updatedAt,
        primaryColor: appSettings.primaryColor,
      })
      .from(appSettings)
      .where(eq(appSettings.id, APP_SETTINGS_ID))
      .limit(1)

    return {
      appName: resolveAppName(row),
      hasLogo: resolveHasLogo(row),
      logoVersion: row?.updatedAt.getTime() ?? 0,
      primaryColor: resolvePrimaryColor(row),
    }
  },
)

/**
 * Lit le nom de l'application. Conserve sa signature d'origine (aucun
 * appelant existant à mettre à jour) mais délègue désormais à
 * `getAppSettingsSummary`, mémorisée, plutôt que d'exécuter sa propre
 * requête — voir le commentaire de `getAppSettingsSummary` pour le détail.
 */
export async function getAppName(): Promise<string> {
  const { appName } = await getAppSettingsSummary()
  return appName
}

/**
 * Indique si un logo personnalisé est configuré, sans en lire les octets.
 * Délègue à `getAppSettingsSummary` (mémorisée) : n'ajoute pas de requête
 * supplémentaire si le nom de l'application a déjà été lu dans le même
 * rendu.
 */
export async function hasLogo(): Promise<boolean> {
  const { hasLogo: value } = await getAppSettingsSummary()
  return value
}

/**
 * Enregistre le nom de l'application. Crée la rangée si elle n'existe pas
 * encore (premier enregistrement), sinon la met à jour.
 *
 * `actorId` : administrateur à l'origine du changement, pour le journal
 * d'audit (voir recordAudit dans src/lib/audit/audit.ts). La lecture de
 * l'ancien nom, l'écriture et l'entrée d'audit sont dans la MÊME transaction :
 * le diff avant/après qu'elle enregistre reste ainsi garanti cohérent avec
 * ce qui a réellement été écrit, et un échec quelconque n'y laisse aucune
 * trace orpheline.
 */
export async function setAppName(actorId: string, appName: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [before] = await tx
      .select({ appName: appSettings.appName })
      .from(appSettings)
      .where(eq(appSettings.id, APP_SETTINGS_ID))
      .limit(1)

    await tx
      .insert(appSettings)
      .values({ id: APP_SETTINGS_ID, appName })
      .onConflictDoUpdate({
        target: appSettings.id,
        set: { appName, updatedAt: new Date() },
      })

    const actorLabel = await resolveActorLabel(tx, actorId)
    await recordAudit(tx, {
      actorId,
      actorLabel,
      action: "settings.app_name.update",
      targetType: "settings",
      targetId: APP_SETTINGS_ID,
      targetLabel: "Nom de l'application",
      details: { appName: { before: resolveAppName(before), after: appName } },
    })
  })
}

export type LogoData = {
  data: Buffer
  mimeType: string
}

/**
 * Lit les octets du logo personnalisé et son type MIME.
 *
 * Requête distincte de `getAppSettingsSummary` (voir son commentaire) : le
 * logo peut peser jusqu'à 1 Mo, on ne veut donc pas le transférer à chaque
 * rendu qui a seulement besoin de savoir s'il existe. Mémorisée avec
 * `cache()` car la route /logo (src/app/logo/route.ts) est la seule
 * consommatrice ; la mémorisation reste utile si jamais elle est appelée
 * plusieurs fois dans le traitement d'une même requête.
 */
export const getLogo = cache(async function getLogo(): Promise<LogoData | null> {
  const [row] = await db
    .select({ logo: appSettings.logo, logoMimeType: appSettings.logoMimeType })
    .from(appSettings)
    .where(eq(appSettings.id, APP_SETTINGS_ID))
    .limit(1)

  if (!row?.logo || !row.logoMimeType) return null

  return { data: row.logo, mimeType: row.logoMimeType }
})

/**
 * Enregistre le logo personnalisé (octets + type MIME, déjà validés par
 * l'appelant — voir src/lib/settings/logo-validation.ts et
 * src/app/actions/app-settings.ts). Crée la rangée si elle n'existe pas
 * encore, avec le nom d'application par défaut (comme `setAppName`, ne
 * touche jamais à `appName` si la rangée existe déjà).
 *
 * `actorId` : voir le commentaire de `setAppName` ci-dessus. Le détail
 * enregistré (type MIME + taille) ne contient JAMAIS les octets du logo
 * lui-même — inutile pour un journal d'audit, et potentiellement volumineux.
 */
export async function setLogo(actorId: string, data: Buffer, mimeType: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(appSettings)
      .values({
        id: APP_SETTINGS_ID,
        appName: DEFAULT_APP_NAME,
        logo: data,
        logoMimeType: mimeType,
      })
      .onConflictDoUpdate({
        target: appSettings.id,
        set: { logo: data, logoMimeType: mimeType, updatedAt: new Date() },
      })

    const actorLabel = await resolveActorLabel(tx, actorId)
    await recordAudit(tx, {
      actorId,
      actorLabel,
      action: "settings.logo.update",
      targetType: "settings",
      targetId: APP_SETTINGS_ID,
      targetLabel: "Logo de l'application",
      details: { mimeType, size: data.byteLength },
    })
  })
}

/**
 * Retire le logo personnalisé : l'application retombe sur l'icône par
 * défaut. Ne fait rien si aucune rangée n'existe encore (rien à effacer) —
 * une entrée d'audit est tout de même écrite dans ce cas (voir `actorId`
 * ci-dessous) : l'action a bien été demandée par un administrateur, même
 * sans effet, et /administration/general n'affiche de toute façon le bouton
 * correspondant que lorsqu'un logo existe déjà.
 */
export async function clearLogo(actorId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(appSettings)
      .set({ logo: null, logoMimeType: null, updatedAt: new Date() })
      .where(eq(appSettings.id, APP_SETTINGS_ID))

    const actorLabel = await resolveActorLabel(tx, actorId)
    await recordAudit(tx, {
      actorId,
      actorLabel,
      action: "settings.logo.delete",
      targetType: "settings",
      targetId: APP_SETTINGS_ID,
      targetLabel: "Logo de l'application",
    })
  })
}

/**
 * Enregistre la couleur principale personnalisée de l'application (voir
 * src/lib/settings/color.ts pour sa validation — `hex` est supposé déjà
 * validé par l'appelant, ex. via son schéma Zod dans
 * src/lib/settings/schemas.ts — et pour les calculs qui en dérivent).
 *
 * Même structure que `setAppName` ci-dessus : crée la rangée si elle
 * n'existe pas encore (avec le nom d'application par défaut, sans jamais y
 * toucher si la rangée existe déjà — même raison que `setLogo`), lecture de
 * l'ancienne valeur + écriture + entrée d'audit dans la MÊME transaction.
 */
export async function setPrimaryColor(actorId: string, hex: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [before] = await tx
      .select({ primaryColor: appSettings.primaryColor })
      .from(appSettings)
      .where(eq(appSettings.id, APP_SETTINGS_ID))
      .limit(1)

    await tx
      .insert(appSettings)
      .values({ id: APP_SETTINGS_ID, appName: DEFAULT_APP_NAME, primaryColor: hex })
      .onConflictDoUpdate({
        target: appSettings.id,
        set: { primaryColor: hex, updatedAt: new Date() },
      })

    const actorLabel = await resolveActorLabel(tx, actorId)
    await recordAudit(tx, {
      actorId,
      actorLabel,
      action: "settings.primary_color.update",
      targetType: "settings",
      targetId: APP_SETTINGS_ID,
      targetLabel: "Couleur principale de l'application",
      details: {
        primaryColor: { before: resolvePrimaryColor(before), after: hex },
      },
    })
  })
}

/**
 * Retire la couleur principale personnalisée : l'application retombe sur le
 * thème par défaut de globals.css. Même structure que `clearLogo`
 * ci-dessus — ne fait rien si aucune rangée n'existe encore (rien à
 * effacer), mais écrit tout de même une entrée d'audit dans ce cas, pour la
 * même raison (l'action a bien été demandée par un administrateur, même
 * sans effet).
 */
export async function clearPrimaryColor(actorId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(appSettings)
      .set({ primaryColor: null, updatedAt: new Date() })
      .where(eq(appSettings.id, APP_SETTINGS_ID))

    const actorLabel = await resolveActorLabel(tx, actorId)
    await recordAudit(tx, {
      actorId,
      actorLabel,
      action: "settings.primary_color.delete",
      targetType: "settings",
      targetId: APP_SETTINGS_ID,
      targetLabel: "Couleur principale de l'application",
    })
  })
}

type SessionUser = { role?: string | null } | null | undefined

/**
 * Un utilisateur peut gérer les paramètres de l'application (page
 * /administration/general) s'il a la permission `settings:update` — plus
 * stricte que `settings:read`, qui ne contrôle que la visibilité du lien
 * dans la barre latérale (voir src/components/app-sidebar.tsx).
 *
 * Asynchrone : les permissions sont désormais résolues en base de données
 * (voir src/lib/auth/permissions.ts) plutôt que dérivées statiquement du
 * rôle.
 */
export async function canManageAppSettings(user: SessionUser): Promise<boolean> {
  return hasPermission(user, "settings", "update")
}
