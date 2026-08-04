import { randomUUID } from "node:crypto"
import { eq, sql } from "drizzle-orm"
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"

// Tests d'intégration de la persistance des paramètres de l'application
// (table app_settings, à ligne unique) contre un vrai Postgres local — voir
// src/lib/auth/auth.integration.test.ts pour le contexte général (chargement de
// .env, exécution via `npm run test:integration` uniquement).
//
// La rangée est un singleton partagé par toute l'application (y compris le
// vrai environnement de développement) : chaque test capture son état avant
// modification et le restaure après, pour ne jamais laisser de nom
// personnalisé « fuiter » en dehors des tests.

type DbModule = typeof import("@/db")
type SchemaModule = typeof import("@/db/schema")
type AppSettingsModule = typeof import("@/lib/settings/app-settings")

let db: DbModule["db"]
let appSettings: SchemaModule["appSettings"]
let auditLog: SchemaModule["auditLog"]
let getAppName: AppSettingsModule["getAppName"]
let setAppName: AppSettingsModule["setAppName"]
let getLogo: AppSettingsModule["getLogo"]
let setLogo: AppSettingsModule["setLogo"]
let clearLogo: AppSettingsModule["clearLogo"]
let hasLogo: AppSettingsModule["hasLogo"]
let setPrimaryColor: AppSettingsModule["setPrimaryColor"]
let clearPrimaryColor: AppSettingsModule["clearPrimaryColor"]
let getAppSettingsSummary: AppSettingsModule["getAppSettingsSummary"]
let canManageAppSettings: AppSettingsModule["canManageAppSettings"]
let DEFAULT_APP_NAME: string
let APP_SETTINGS_ID: string

type AppSettingsRow = {
  id: string
  appName: string
  logo: Buffer | null
  logoMimeType: string | null
  primaryColor: string | null
  updatedAt: Date
}

let originalRow: AppSettingsRow | undefined

// Acteur des mutations de ce fichier (setAppName/setLogo/clearLogo prennent
// désormais un `actorId` en premier paramètre, pour le journal d'audit —
// voir src/lib/audit/audit.ts). Ne correspond à aucun utilisateur réel,
// comme TEST_ACTOR_ID dans src/lib/auth/roles.integration.test.ts : ces
// fonctions n'ont aucune logique liée à l'identité de l'acteur.
const TEST_ACTOR_ID = `test-actor-${randomUUID()}`

beforeAll(async () => {
  try {
    process.loadEnvFile()
  } catch {
    // Pas de fichier .env trouvé : on continue avec l'environnement existant.
  }

  const [dbModule, schemaModule, appSettingsModule] = await Promise.all([
    import("@/db"),
    import("@/db/schema"),
    import("@/lib/settings/app-settings"),
  ])
  db = dbModule.db
  appSettings = schemaModule.appSettings
  auditLog = schemaModule.auditLog
  getAppName = appSettingsModule.getAppName
  setAppName = appSettingsModule.setAppName
  getLogo = appSettingsModule.getLogo
  setLogo = appSettingsModule.setLogo
  clearLogo = appSettingsModule.clearLogo
  hasLogo = appSettingsModule.hasLogo
  setPrimaryColor = appSettingsModule.setPrimaryColor
  clearPrimaryColor = appSettingsModule.clearPrimaryColor
  getAppSettingsSummary = appSettingsModule.getAppSettingsSummary
  canManageAppSettings = appSettingsModule.canManageAppSettings
  DEFAULT_APP_NAME = appSettingsModule.DEFAULT_APP_NAME
  APP_SETTINGS_ID = appSettingsModule.APP_SETTINGS_ID

  try {
    await db.execute(sql`select 1`)
  } catch (cause) {
    throw new Error(
      "Impossible de se connecter à PostgreSQL (voir DATABASE_URL dans .env, " +
        "port 5433 par défaut). Démarrez la base avec « docker compose up -d », " +
        "ou lancez seulement les tests qui n'en ont pas besoin avec " +
        "« npm run test:unit ».",
      { cause: cause as Error },
    )
  }
}, 20_000)

beforeEach(async () => {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.id, APP_SETTINGS_ID))
    .limit(1)
  originalRow = row
})

afterEach(async () => {
  // Entrées du journal d'audit écrites par le test qui vient de s'exécuter
  // (settings.app_name.update / settings.logo.update / settings.logo.delete,
  // voir src/lib/settings/app-settings.ts) : toutes ont TEST_ACTOR_ID comme
  // acteur.
  await db.delete(auditLog).where(eq(auditLog.actorId, TEST_ACTOR_ID))

  if (originalRow) {
    await db
      .insert(appSettings)
      .values(originalRow)
      .onConflictDoUpdate({
        target: appSettings.id,
        set: {
          appName: originalRow.appName,
          logo: originalRow.logo,
          logoMimeType: originalRow.logoMimeType,
          primaryColor: originalRow.primaryColor,
          updatedAt: originalRow.updatedAt,
        },
      })
  } else {
    await db.delete(appSettings).where(eq(appSettings.id, APP_SETTINGS_ID))
  }
})

describe("app-settings — intégration Postgres", () => {
  it("retourne le nom par défaut quand aucune rangée n'existe", async () => {
    await db.delete(appSettings).where(eq(appSettings.id, APP_SETTINGS_ID))

    expect(await getAppName()).toBe(DEFAULT_APP_NAME)
  })

  it("écrit un nom personnalisé puis le relit", async () => {
    await db.delete(appSettings).where(eq(appSettings.id, APP_SETTINGS_ID))

    await setAppName(TEST_ACTOR_ID, "Application de test")

    expect(await getAppName()).toBe("Application de test")
  })

  it("met à jour la rangée existante plutôt que d'en créer une nouvelle", async () => {
    await setAppName(TEST_ACTOR_ID, "Premier nom")
    await setAppName(TEST_ACTOR_ID, "Deuxième nom")

    const rows = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.id, APP_SETTINGS_ID))

    expect(rows).toHaveLength(1)
    expect(rows[0]?.appName).toBe("Deuxième nom")
  })
})

describe("setLogo/getLogo/clearLogo — intégration Postgres", () => {
  it("retourne null et faux quand aucun logo n'est enregistré", async () => {
    await clearLogo(TEST_ACTOR_ID)

    expect(await getLogo()).toBeNull()
    expect(await hasLogo()).toBe(false)
  })

  it("enregistre un logo puis le relit avec son type MIME", async () => {
    const data = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

    await setLogo(TEST_ACTOR_ID, data, "image/png")

    const logo = await getLogo()
    expect(logo).not.toBeNull()
    expect(logo?.mimeType).toBe("image/png")
    expect(logo?.data.equals(data)).toBe(true)
    expect(await hasLogo()).toBe(true)
  })

  it("met à jour la rangée existante plutôt que d'en créer une nouvelle", async () => {
    await setLogo(TEST_ACTOR_ID, Buffer.from([1, 2, 3]), "image/png")
    await setLogo(TEST_ACTOR_ID, Buffer.from([4, 5, 6]), "image/webp")

    const rows = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.id, APP_SETTINGS_ID))

    expect(rows).toHaveLength(1)
    expect(rows[0]?.logoMimeType).toBe("image/webp")
    expect(rows[0]?.logo?.equals(Buffer.from([4, 5, 6]))).toBe(true)
  })

  it("ne touche pas au nom de l'application déjà enregistré", async () => {
    await setAppName(TEST_ACTOR_ID, "Nom conservé")

    await setLogo(TEST_ACTOR_ID, Buffer.from([1, 2, 3]), "image/png")

    expect(await getAppName()).toBe("Nom conservé")
  })

  it("retire le logo enregistré", async () => {
    await setLogo(TEST_ACTOR_ID, Buffer.from([1, 2, 3]), "image/png")

    await clearLogo(TEST_ACTOR_ID)

    expect(await getLogo()).toBeNull()
    expect(await hasLogo()).toBe(false)
  })
})

describe("setPrimaryColor/clearPrimaryColor — intégration Postgres", () => {
  it("retourne null quand aucune couleur n'est enregistrée", async () => {
    await clearPrimaryColor(TEST_ACTOR_ID)

    const { primaryColor } = await getAppSettingsSummary()
    expect(primaryColor).toBeNull()
  })

  it("enregistre une couleur puis la relit", async () => {
    await setPrimaryColor(TEST_ACTOR_ID, "#2563eb")

    const { primaryColor } = await getAppSettingsSummary()
    expect(primaryColor).toBe("#2563eb")
  })

  it("met à jour la rangée existante plutôt que d'en créer une nouvelle", async () => {
    await setPrimaryColor(TEST_ACTOR_ID, "#2563eb")
    await setPrimaryColor(TEST_ACTOR_ID, "#dc2626")

    const rows = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.id, APP_SETTINGS_ID))

    expect(rows).toHaveLength(1)
    expect(rows[0]?.primaryColor).toBe("#dc2626")
  })

  it("ne touche pas au nom de l'application déjà enregistré", async () => {
    await setAppName(TEST_ACTOR_ID, "Nom conservé (couleur)")

    await setPrimaryColor(TEST_ACTOR_ID, "#2563eb")

    expect(await getAppName()).toBe("Nom conservé (couleur)")
  })

  it("retire la couleur enregistrée", async () => {
    await setPrimaryColor(TEST_ACTOR_ID, "#2563eb")

    await clearPrimaryColor(TEST_ACTOR_ID)

    const { primaryColor } = await getAppSettingsSummary()
    expect(primaryColor).toBeNull()
  })

  it("écrit une entrée d'audit settings.primary_color.update avec le diff before/after", async () => {
    await clearPrimaryColor(TEST_ACTOR_ID)

    await setPrimaryColor(TEST_ACTOR_ID, "#2563eb")

    const [entry] = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.actorId, TEST_ACTOR_ID))
      .orderBy(sql`created_at desc`)
      .limit(1)

    expect(entry?.action).toBe("settings.primary_color.update")
    expect(entry?.details).toMatchObject({
      primaryColor: { before: null, after: "#2563eb" },
    })
  })

  it("écrit une entrée d'audit settings.primary_color.delete", async () => {
    await setPrimaryColor(TEST_ACTOR_ID, "#2563eb")

    await clearPrimaryColor(TEST_ACTOR_ID)

    const [entry] = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.actorId, TEST_ACTOR_ID))
      .orderBy(sql`created_at desc`)
      .limit(1)

    expect(entry?.action).toBe("settings.primary_color.delete")
  })
})

describe("canManageAppSettings — intégration Postgres", () => {
  // canManageAppSettings délègue à hasPermission (src/lib/auth/permissions.ts),
  // qui résout désormais les permissions depuis `role_permission` — donc
  // testée ici plutôt que dans app-settings.test.ts (voir son commentaire).
  // "admin" court-circuite cette lecture (voir getPermissionsForRole), mais
  // "member" y passe réellement : ce test vérifie donc aussi la valeur
  // seedée par la migration 0005 (member -> settings:read, PAS settings:update).

  it("autorise un administrateur", async () => {
    expect(await canManageAppSettings({ role: "admin" })).toBe(true)
  })

  it("refuse un membre (seedé avec settings:read uniquement)", async () => {
    expect(await canManageAppSettings({ role: "member" })).toBe(false)
  })

  it("refuse un utilisateur absent", async () => {
    expect(await canManageAppSettings(null)).toBe(false)
    expect(await canManageAppSettings(undefined)).toBe(false)
  })
})
