import { randomUUID } from "node:crypto"
import { eq, sql } from "drizzle-orm"
import { afterEach, beforeAll, describe, expect, it } from "vitest"

// Tests d'intégration de la résolution DYNAMIQUE des permissions (tables
// `role` et `role_permission`, voir src/db/schema.ts et la migration 0005)
// contre un vrai Postgres local — voir src/lib/auth/auth.integration.test.ts
// pour le contexte général (chargement de .env, exécution via
// `npm run test:integration` uniquement).
//
// La logique pure (catalogue, libellés, court-circuit admin) est testée
// sans base de données dans src/lib/auth/permissions.test.ts — voir son
// commentaire d'en-tête.

type DbModule = typeof import("@/db")
type SchemaModule = typeof import("@/db/schema")
type PermissionsModule = typeof import("@/lib/auth/permissions")

let db: DbModule["db"]
let dbSchema: SchemaModule
let getPermissionsForRole: PermissionsModule["getPermissionsForRole"]
let getGrantedPermissions: PermissionsModule["getGrantedPermissions"]
let hasPermission: PermissionsModule["hasPermission"]
let getAllPermissions: PermissionsModule["getAllPermissions"]

// Rôles personnalisés créés par les tests de ce fichier, à supprimer après
// coup — même logique que createdUserIds dans auth.integration.test.ts.
const createdRoleIds: string[] = []

function uniqueRoleId(label: string) {
  return `test-integration-${label}-${Date.now()}-${randomUUID().slice(0, 8)}`
}

beforeAll(async () => {
  try {
    process.loadEnvFile()
  } catch {
    // Pas de fichier .env trouvé : on continue avec l'environnement existant.
  }

  const [dbModule, schemaModule, permissionsModule] = await Promise.all([
    import("@/db"),
    import("@/db/schema"),
    import("@/lib/auth/permissions"),
  ])
  db = dbModule.db
  dbSchema = schemaModule
  getPermissionsForRole = permissionsModule.getPermissionsForRole
  getGrantedPermissions = permissionsModule.getGrantedPermissions
  hasPermission = permissionsModule.hasPermission
  getAllPermissions = permissionsModule.getAllPermissions

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

afterEach(async () => {
  while (createdRoleIds.length > 0) {
    const id = createdRoleIds.pop()
    if (id) await db.delete(dbSchema.role).where(eq(dbSchema.role.id, id))
  }
})

describe("getPermissionsForRole — intégration Postgres", () => {
  it("résout exactement les permissions stockées en base pour 'member'", async () => {
    // Ne PAS supposer l'état seedé par la migration 0005 : le rôle member est
    // modifiable depuis /administration/roles, donc une base de développement
    // peut légitimement contenir d'autres permissions. On compare à ce que la
    // table contient réellement au moment du test.
    const rows = await db
      .select({ permission: dbSchema.rolePermission.permission })
      .from(dbSchema.rolePermission)
      .where(eq(dbSchema.rolePermission.roleId, "member"))

    const granted = await getPermissionsForRole("member")

    expect(granted).toEqual(new Set(rows.map((row) => row.permission)))
  })

  it("résout les permissions d'un rôle personnalisé depuis role_permission", async () => {
    const roleId = uniqueRoleId("custom-role")
    createdRoleIds.push(roleId)

    await db
      .insert(dbSchema.role)
      .values({ id: roleId, name: "Rôle de test", isSystem: false })
    await db.insert(dbSchema.rolePermission).values([
      { roleId, permission: "user:read" },
      { roleId, permission: "role:read" },
    ])

    const granted = await getPermissionsForRole(roleId)

    expect(granted).toEqual(new Set(["user:read", "role:read"]))
  })

  it("retourne un ensemble vide pour un rôle qui n'existe pas", async () => {
    const granted = await getPermissionsForRole("un-role-qui-nexiste-pas")

    expect(granted).toEqual(new Set())
  })

  it("court-circuite 'admin' vers le catalogue complet sans dépendre de role_permission", async () => {
    // Vérifie la prémisse du court-circuit : "admin" n'a réellement aucune
    // rangée dans role_permission (voir la migration 0005) — donc si ce
    // test passe, c'est bien le court-circuit qui a répondu, pas une lecture
    // en base qui aurait fortuitement retourné le même résultat.
    const adminRows = await db
      .select()
      .from(dbSchema.rolePermission)
      .where(eq(dbSchema.rolePermission.roleId, "admin"))
    expect(adminRows).toHaveLength(0)

    const granted = await getPermissionsForRole("admin")
    expect(granted).toEqual(getAllPermissions())
  })
})

describe("hasPermission / getGrantedPermissions — intégration Postgres", () => {
  it("accorde exactement les permissions du rôle, ni plus ni moins", async () => {
    // Rôle jetable aux permissions connues, plutôt que 'member' : member est
    // modifiable depuis l'interface d'administration, son contenu réel dans
    // une base de développement n'est donc pas un invariant de test.
    const roleId = uniqueRoleId("verif-has-permission")
    createdRoleIds.push(roleId)
    await db
      .insert(dbSchema.role)
      .values({ id: roleId, name: "Vérification", isSystem: false })
    await db.insert(dbSchema.rolePermission).values([
      { roleId, permission: "settings:read" },
      { roleId, permission: "user:read" },
    ])

    const holder = { role: roleId }

    expect(await hasPermission(holder, "settings", "read")).toBe(true)
    expect(await hasPermission(holder, "user", "read")).toBe(true)
    expect(await hasPermission(holder, "settings", "update")).toBe(false)
    expect(await hasPermission(holder, "user", "create")).toBe(false)
    expect(await hasPermission(holder, "role", "read")).toBe(false)
  })

  it("un rôle inconnu n'accorde aucune permission", async () => {
    const granted = await getGrantedPermissions({ role: "un-role-qui-nexiste-pas" })

    expect(granted.size).toBe(0)
  })
})
