import { randomUUID } from "node:crypto"
import { and, eq, inArray, ne, or, sql } from "drizzle-orm"
import { afterEach, beforeAll, describe, expect, it } from "vitest"

// Tests d'intégration du journal d'audit (src/lib/audit/audit.ts) contre un
// vrai Postgres local — voir src/lib/auth/auth.integration.test.ts pour le
// contexte général (chargement de .env, exécution via
// `npm run test:integration` uniquement). La logique pure (formatage des
// détails) est testée sans base de données dans
// src/lib/audit/format-details.test.ts ; la validation du catalogue
// (recordAudit) est testée sans base de données dans src/lib/audit/audit.test.ts.
//
// Ce fichier couvre :
//   - resolveActorLabel contre de vraies rangées `user` ;
//   - l'ATOMICITÉ de recordAudit à l'intérieur d'une transaction (le coeur
//     du contrat documenté sur AuditExecutor) ;
//   - que chaque mutation câblée (users.ts, create-user.ts, roles.ts,
//     app-settings.ts) écrit EXACTEMENT une entrée avec le bon acteur/la
//     bonne cible/le bon détail, et qu'une mutation qui ÉCHOUE (garde-fou du
//     dernier administrateur, contrainte de clé étrangère sur un rôle
//     encore utilisé) n'en laisse AUCUNE ;
//   - que `auth.api.signInEmail` déclenche bien auth.login (hook
//     databaseHooks.session.create.after, src/lib/auth/index.ts) ;
//   - la pagination et les filtres de listAuditEntries.

type AuthModule = typeof import("@/lib/auth")
type DbModule = typeof import("@/db")
type SchemaModule = typeof import("@/db/schema")
type AuditModule = typeof import("@/lib/audit/audit")
type UsersModule = typeof import("@/lib/auth/users")
type CreateUserModule = typeof import("@/lib/auth/create-user")
type RolesModule = typeof import("@/lib/auth/roles")
type AppSettingsModule = typeof import("@/lib/settings/app-settings")

let auth: AuthModule["auth"]
let db: DbModule["db"]
let dbSchema: SchemaModule
let recordAudit: AuditModule["recordAudit"]
let resolveActorLabel: AuditModule["resolveActorLabel"]
let listAuditEntries: AuditModule["listAuditEntries"]
let updateUser: UsersModule["updateUser"]
let deleteUser: UsersModule["deleteUser"]
let createUserWithPassword: CreateUserModule["createUserWithPassword"]
let createRole: RolesModule["createRole"]
let updateRole: RolesModule["updateRole"]
let deleteRole: RolesModule["deleteRole"]
let setAppName: AppSettingsModule["setAppName"]
let getAppName: AppSettingsModule["getAppName"]

// Comptes et rôles créés par les tests de ce fichier, à supprimer après coup
// — même logique que les autres fichiers d'intégration (voir
// src/lib/auth/users.integration.test.ts). Le nom de l'application (rangée
// singleton app_settings) est restauré séparément (voir `originalAppName`).
const createdUserIds: string[] = []
const createdRoleIds: string[] = []
let originalAppName: string

function uniqueSuffix() {
  return randomUUID().slice(0, 8)
}

function uniqueEmail(label: string) {
  return `test-integration-${label}-${Date.now()}-${uniqueSuffix()}@example.test`
}

beforeAll(async () => {
  try {
    process.loadEnvFile()
  } catch {
    // Pas de fichier .env trouvé : on continue avec l'environnement existant.
  }

  const [authModule, dbModule, schemaModule, auditModule, usersModule, createUserModule, rolesModule, appSettingsModule] =
    await Promise.all([
      import("@/lib/auth"),
      import("@/db"),
      import("@/db/schema"),
      import("@/lib/audit/audit"),
      import("@/lib/auth/users"),
      import("@/lib/auth/create-user"),
      import("@/lib/auth/roles"),
      import("@/lib/settings/app-settings"),
    ])
  auth = authModule.auth
  db = dbModule.db
  dbSchema = schemaModule
  recordAudit = auditModule.recordAudit
  resolveActorLabel = auditModule.resolveActorLabel
  listAuditEntries = auditModule.listAuditEntries
  updateUser = usersModule.updateUser
  deleteUser = usersModule.deleteUser
  createUserWithPassword = createUserModule.createUserWithPassword
  createRole = rolesModule.createRole
  updateRole = rolesModule.updateRole
  deleteRole = rolesModule.deleteRole
  setAppName = appSettingsModule.setAppName
  getAppName = appSettingsModule.getAppName

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

  originalAppName = await getAppName()
}, 20_000)

afterEach(async () => {
  // Entrées d'audit produites par les tests qui viennent de s'exécuter :
  // toutes référencent un identifiant de createdUserIds/createdRoleIds
  // (comme acteur OU comme cible), capturé AVANT le nettoyage des
  // utilisateurs/rôles eux-mêmes — même mécanisme que les autres fichiers
  // d'intégration (voir src/lib/auth/users.integration.test.ts).
  const ids = [...createdUserIds, ...createdRoleIds]
  if (ids.length > 0) {
    await db
      .delete(dbSchema.auditLog)
      .where(
        or(inArray(dbSchema.auditLog.actorId, ids), inArray(dbSchema.auditLog.targetId, ids)),
      )
  }

  if (auth) {
    const context = await auth.$context
    while (createdUserIds.length > 0) {
      const id = createdUserIds.pop()
      if (id) await context.internalAdapter.deleteUser(id)
    }
  }
  while (createdRoleIds.length > 0) {
    const id = createdRoleIds.pop()
    if (id) await db.delete(dbSchema.role).where(eq(dbSchema.role.id, id))
  }

  // Restaure le nom de l'application si un test l'a changé (rangée
  // singleton partagée avec le vrai environnement de développement — même
  // précaution que src/lib/settings/app-settings.integration.test.ts).
  if ((await getAppName()) !== originalAppName) {
    await setAppName("system-restore", originalAppName)
    await db
      .delete(dbSchema.auditLog)
      .where(eq(dbSchema.auditLog.actorId, "system-restore"))
  }
})

/**
 * Crée un utilisateur de test — même chemin interne que les autres fichiers
 * d'intégration (context.internalAdapter + context.password.hash). `role`
 * accepte aussi un identifiant de rôle personnalisé (chaîne quelconque), pas
 * seulement "admin"/"member" : voir le test "rôle encore utilisé" ci-dessous
 * (deleteRole bloqué), qui a besoin d'attacher un utilisateur à un rôle
 * fraîchement créé pour le test.
 */
async function createTestUser(label: string, role: "admin" | "member" | (string & {}) = "member") {
  const context = await auth.$context
  const email = uniqueEmail(label)
  const hashedPassword = await context.password.hash("MotDePasse123!")

  const user = await context.internalAdapter.createUser({
    name: `Utilisateur de test (${label})`,
    email,
    emailVerified: true,
    role,
  })
  await context.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: hashedPassword,
  })

  createdUserIds.push(user.id)
  return { ...user, password: "MotDePasse123!" }
}

/**
 * Rend `soloAdminId` temporairement le SEUL détenteur du rôle "admin" en
 * rétrogradant tout autre administrateur existant (y compris le compte de
 * développement) le temps d'exécuter `fn`, puis restaure systématiquement
 * leur rôle d'origine — copie minimale de la même technique que
 * src/lib/auth/users.integration.test.ts (voir son commentaire pour le
 * détail de la course anti-TOCTOU que ça permet de tester), dupliquée ici
 * plutôt que partagée, par cohérence avec le reste des fichiers
 * d'intégration (chacun est autonome).
 */
async function withSingleAdmin<T>(soloAdminId: string, fn: () => Promise<T>): Promise<T> {
  const others = await db
    .select({ id: dbSchema.user.id })
    .from(dbSchema.user)
    .where(and(eq(dbSchema.user.role, "admin"), ne(dbSchema.user.id, soloAdminId)))
  const otherIds = others.map((row) => row.id)

  if (otherIds.length > 0) {
    await db.update(dbSchema.user).set({ role: "member" }).where(inArray(dbSchema.user.id, otherIds))
  }

  try {
    return await fn()
  } finally {
    if (otherIds.length > 0) {
      await db.update(dbSchema.user).set({ role: "admin" }).where(inArray(dbSchema.user.id, otherIds))
    }
  }
}

describe("resolveActorLabel — intégration Postgres", () => {
  it('retourne "Système" pour un acteur nul', async () => {
    expect(await resolveActorLabel(db, null)).toBe("Système")
  })

  it("retourne « Nom (courriel) » pour un utilisateur réel", async () => {
    const testUser = await createTestUser("resolve-label")

    expect(await resolveActorLabel(db, testUser.id)).toBe(`${testUser.name} (${testUser.email})`)
  })

  it("retombe sur un libellé neutre pour un identifiant introuvable", async () => {
    expect(await resolveActorLabel(db, "id-qui-nexiste-pas")).toBe("Utilisateur inconnu")
  })
})

describe("recordAudit — atomicité avec une transaction", () => {
  it("une entrée écrite PUIS annulée (rollback) ne persiste pas", async () => {
    const marker = `atomicity-${uniqueSuffix()}`

    await expect(
      db.transaction(async (tx) => {
        await recordAudit(tx, {
          actorId: null,
          actorLabel: "Système",
          action: "auth.login",
          targetType: "user",
          targetId: marker,
        })
        // Force l'annulation de la transaction APRÈS l'écriture ci-dessus :
        // si `recordAudit` ne respectait pas correctement l'exécuteur de
        // transaction qu'on lui passe (ex. s'il utilisait `db` en interne au
        // lieu de `tx`), la rangée survivrait malgré ce rollback.
        throw new Error("Échec volontaire pour tester le rollback")
      }),
    ).rejects.toThrow(/échec volontaire/i)

    const rows = await db
      .select()
      .from(dbSchema.auditLog)
      .where(eq(dbSchema.auditLog.targetId, marker))
    expect(rows).toHaveLength(0)
  })

  it("une entrée écrite dans une transaction qui VALIDE persiste bien", async () => {
    const marker = `atomicity-commit-${uniqueSuffix()}`

    await db.transaction(async (tx) => {
      await recordAudit(tx, {
        actorId: null,
        actorLabel: "Système",
        action: "auth.login",
        targetType: "user",
        targetId: marker,
      })
    })

    const rows = await db
      .select()
      .from(dbSchema.auditLog)
      .where(eq(dbSchema.auditLog.targetId, marker))
    expect(rows).toHaveLength(1)

    await db.delete(dbSchema.auditLog).where(eq(dbSchema.auditLog.targetId, marker))
  })
})

describe("user.create — écrit exactement une entrée", () => {
  it("via createUserWithPassword, avec l'acteur et la cible attendus", async () => {
    const actor = await createTestUser("audit-create-user-actor", "admin")
    const email = uniqueEmail("audit-create-user")

    const created = await createUserWithPassword({
      name: "Nouvel utilisateur audité",
      email,
      password: "MotDePasse123!",
      role: "member",
      actorId: actor.id,
    })
    createdUserIds.push(created.id)

    const rows = await db
      .select()
      .from(dbSchema.auditLog)
      .where(eq(dbSchema.auditLog.targetId, created.id))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: "user.create",
      actorId: actor.id,
      actorLabel: `${actor.name} (${actor.email})`,
      targetType: "user",
      targetLabel: `Nouvel utilisateur audité (${email})`,
    })
    expect(rows[0]?.details).toEqual({ role: "member" })
  })

  it('avec actorId nul (script), l\'acteur est "Système"', async () => {
    const email = uniqueEmail("audit-create-system")

    const created = await createUserWithPassword({
      name: "Créé par script",
      email,
      password: "MotDePasse123!",
      role: "member",
      actorId: null,
    })
    createdUserIds.push(created.id)

    const [row] = await db
      .select()
      .from(dbSchema.auditLog)
      .where(eq(dbSchema.auditLog.targetId, created.id))
    expect(row?.actorId).toBeNull()
    expect(row?.actorLabel).toBe("Système")
  })
})

describe("user.update / user.delete — écrivent exactement une entrée", () => {
  it("user.update : diff nom + rôle", async () => {
    const actor = await createTestUser("audit-update-actor", "admin")
    const target = await createTestUser("audit-update-target", "member")

    await updateUser(actor.id, target.id, { name: "Nom modifié", role: "admin" })

    const rows = await db
      .select()
      .from(dbSchema.auditLog)
      .where(eq(dbSchema.auditLog.targetId, target.id))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: "user.update",
      actorId: actor.id,
      targetType: "user",
    })
    expect(rows[0]?.details).toEqual({
      name: { before: target.name, after: "Nom modifié" },
      role: { before: "member", after: "admin" },
    })

    // Rétablit un rôle non-admin pour ne pas fausser d'autres tests
    // (garde-fou du dernier administrateur, décompte des admins) — la
    // suppression douce faite par afterEach n'annule pas ce changement de
    // rôle par elle-même tant que le compte n'est pas supprimé.
    await db.update(dbSchema.user).set({ role: "member" }).where(eq(dbSchema.user.id, target.id))
  })

  it("user.delete : cliché de la cible, aucun détail", async () => {
    const actor = await createTestUser("audit-delete-actor", "admin")
    const target = await createTestUser("audit-delete-target", "member")

    await deleteUser(actor.id, target.id)

    const rows = await db
      .select()
      .from(dbSchema.auditLog)
      .where(eq(dbSchema.auditLog.targetId, target.id))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: "user.delete",
      actorId: actor.id,
      actorLabel: `${actor.name} (${actor.email})`,
      targetType: "user",
      targetLabel: `${target.name} (${target.email})`,
      details: null,
    })
  })

  it("ATOMICITÉ : le garde-fou du dernier administrateur bloque deleteUser et n'écrit AUCUNE entrée", async () => {
    const soloAdmin = await createTestUser("audit-last-admin", "admin")
    const actor = await createTestUser("audit-last-admin-actor", "member")

    await withSingleAdmin(soloAdmin.id, async () => {
      await expect(deleteUser(actor.id, soloAdmin.id)).rejects.toThrow(/dernier administrateur/i)
    })

    const rows = await db
      .select()
      .from(dbSchema.auditLog)
      .where(eq(dbSchema.auditLog.targetId, soloAdmin.id))
    expect(rows).toHaveLength(0)
  })
})

describe("role.create / role.update / role.delete — écrivent exactement une entrée", () => {
  it("role.create : permissions accordées", async () => {
    const actor = await createTestUser("audit-role-create-actor", "admin")
    const name = `Rôle audité ${uniqueSuffix()}`

    const created = await createRole(actor.id, { name, permissions: ["user:read"] })
    createdRoleIds.push(created.id)

    const rows = await db
      .select()
      .from(dbSchema.auditLog)
      .where(eq(dbSchema.auditLog.targetId, created.id))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: "role.create",
      actorId: actor.id,
      targetType: "role",
      targetLabel: `Rôle ${name}`,
    })
    expect(rows[0]?.details).toEqual({ permissions: ["user:read"] })
  })

  it("role.update : diff nom + permissions ajoutées/retirées", async () => {
    const actor = await createTestUser("audit-role-update-actor", "admin")
    const created = await createRole(actor.id, {
      name: `Rôle avant ${uniqueSuffix()}`,
      permissions: ["user:read"],
    })
    createdRoleIds.push(created.id)

    await updateRole(actor.id, created.id, {
      name: "Rôle après",
      permissions: ["user:update"],
    })

    const rows = await db
      .select()
      .from(dbSchema.auditLog)
      .where(and(eq(dbSchema.auditLog.targetId, created.id), eq(dbSchema.auditLog.action, "role.update")))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.details).toEqual({
      name: { before: created.name, after: "Rôle après" },
      permissionsAdded: ["user:update"],
      permissionsRemoved: ["user:read"],
    })
  })

  it("role.delete : cliché de la cible", async () => {
    const actor = await createTestUser("audit-role-delete-actor", "admin")
    const created = await createRole(actor.id, {
      name: `Rôle à supprimer ${uniqueSuffix()}`,
      permissions: [],
    })

    await deleteRole(actor.id, created.id)

    const rows = await db
      .select()
      .from(dbSchema.auditLog)
      .where(and(eq(dbSchema.auditLog.targetId, created.id), eq(dbSchema.auditLog.action, "role.delete")))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.targetLabel).toBe(`Rôle ${created.name}`)

    await db.delete(dbSchema.auditLog).where(eq(dbSchema.auditLog.targetId, created.id))
  })

  it("ATOMICITÉ : un rôle encore utilisé bloque deleteRole et n'écrit AUCUNE entrée role.delete", async () => {
    const actor = await createTestUser("audit-role-blocked-actor", "admin")
    const created = await createRole(actor.id, {
      name: `Rôle utilisé ${uniqueSuffix()}`,
      permissions: [],
    })
    createdRoleIds.push(created.id)

    const holder = await createTestUser("audit-role-blocked-holder", created.id)

    await expect(deleteRole(actor.id, created.id)).rejects.toThrow(/utilisateur/i)

    const rows = await db
      .select()
      .from(dbSchema.auditLog)
      .where(and(eq(dbSchema.auditLog.targetId, created.id), eq(dbSchema.auditLog.action, "role.delete")))
    expect(rows).toHaveLength(0)

    // Nettoyage manuel dans le bon ordre (utilisateur avant rôle, voir
    // src/lib/auth/roles.integration.test.ts) : `holder` a déjà été poussé
    // dans createdUserIds par createTestUser, mais afterEach supprime les
    // UTILISATEURS avant les RÔLES, donc l'ordre est déjà correct — rien de
    // plus à faire ici que documenter pourquoi ça fonctionne.
    void holder
  })
})

describe("settings.app_name.update — écrit exactement une entrée", () => {
  it("diff avant/après du nom de l'application", async () => {
    const actor = await createTestUser("audit-app-name-actor", "admin")

    await setAppName(actor.id, "Nom audité de test")

    const rows = await db
      .select()
      .from(dbSchema.auditLog)
      .where(and(eq(dbSchema.auditLog.actorId, actor.id), eq(dbSchema.auditLog.action, "settings.app_name.update")))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.details).toEqual({
      appName: { before: originalAppName, after: "Nom audité de test" },
    })

    await setAppName(actor.id, originalAppName)
  })
})

describe("auth.login — hook databaseHooks.session.create.after", () => {
  it("signInEmail écrit une entrée auth.login pour l'utilisateur connecté", async () => {
    const testUser = await createTestUser("audit-login")

    const before = new Date()
    await auth.api.signInEmail({
      body: { email: testUser.email, password: testUser.password },
      headers: new Headers(),
    })

    const rows = await db
      .select()
      .from(dbSchema.auditLog)
      .where(and(eq(dbSchema.auditLog.actorId, testUser.id), eq(dbSchema.auditLog.action, "auth.login")))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.actorLabel).toBe(`${testUser.name} (${testUser.email})`)
    expect(rows[0]!.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
  })

  it("une tentative de connexion ÉCHOUÉE n'écrit AUCUNE entrée (volontairement pas journalisée, voir src/lib/audit/audit.ts)", async () => {
    const testUser = await createTestUser("audit-login-failed")

    await expect(
      auth.api.signInEmail({
        body: { email: testUser.email, password: "mauvais-mot-de-passe" },
        headers: new Headers(),
      }),
    ).rejects.toThrow()

    const rows = await db
      .select()
      .from(dbSchema.auditLog)
      .where(and(eq(dbSchema.auditLog.actorId, testUser.id), eq(dbSchema.auditLog.action, "auth.login")))
    expect(rows).toHaveLength(0)
  })
})

describe("listAuditEntries — pagination et filtres, intégration Postgres", () => {
  it("pagine un ensemble connu d'entrées, plus récentes en premier", async () => {
    const actor = await createTestUser("audit-pagination")

    // Cinq entrées synthétiques, horodatées dans l'ordre (chacune un peu
    // après la précédente), toutes rattachées au même acteur unique : filtrer
    // par cet acteur isole exactement ces cinq rangées de tout le reste du
    // journal (activité réelle de développement, autres tests).
    const labels = ["1", "2", "3", "4", "5"]
    for (const label of labels) {
      await recordAudit(db, {
        actorId: actor.id,
        actorLabel: `${actor.name} (${actor.email})`,
        action: "profile.name.update",
        targetType: "user",
        targetId: actor.id,
        targetLabel: `Entrée ${label}`,
      })
      // Écarte suffisamment les horodatages pour un tri déterministe (la
      // colonne created_at a une résolution à la milliseconde).
      await new Promise((resolve) => setTimeout(resolve, 5))
    }

    const firstPage = await listAuditEntries({ actorId: actor.id, page: 1, perPage: 2 })
    expect(firstPage.total).toBe(5)
    expect(firstPage.entries).toHaveLength(2)
    expect(firstPage.entries.map((e) => e.targetLabel)).toEqual(["Entrée 5", "Entrée 4"])

    const secondPage = await listAuditEntries({ actorId: actor.id, page: 2, perPage: 2 })
    expect(secondPage.entries.map((e) => e.targetLabel)).toEqual(["Entrée 3", "Entrée 2"])

    const thirdPage = await listAuditEntries({ actorId: actor.id, page: 3, perPage: 2 })
    expect(thirdPage.entries.map((e) => e.targetLabel)).toEqual(["Entrée 1"])
  })

  it("filtre par action", async () => {
    const actor = await createTestUser("audit-filter-action")

    await recordAudit(db, {
      actorId: actor.id,
      actorLabel: `${actor.name} (${actor.email})`,
      action: "profile.name.update",
      targetType: "user",
      targetId: actor.id,
    })
    await recordAudit(db, {
      actorId: actor.id,
      actorLabel: `${actor.name} (${actor.email})`,
      action: "auth.password.change",
      targetType: "user",
      targetId: actor.id,
    })

    const result = await listAuditEntries({ actorId: actor.id, action: "auth.password.change" })
    expect(result.total).toBe(1)
    expect(result.entries[0]?.action).toBe("auth.password.change")
  })

  it("filtre par acteur", async () => {
    const actorA = await createTestUser("audit-filter-actor-a")
    const actorB = await createTestUser("audit-filter-actor-b")

    for (const actor of [actorA, actorB]) {
      await recordAudit(db, {
        actorId: actor.id,
        actorLabel: `${actor.name} (${actor.email})`,
        action: "profile.name.update",
        targetType: "user",
        targetId: actor.id,
      })
    }

    const resultA = await listAuditEntries({ actorId: actorA.id })
    expect(resultA.total).toBe(1)
    expect(resultA.entries[0]?.actorId).toBe(actorA.id)
  })
})
