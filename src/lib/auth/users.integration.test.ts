import { randomUUID } from "node:crypto"
import { and, eq, inArray, notInArray, or, sql } from "drizzle-orm"
import { afterEach, beforeAll, describe, expect, it } from "vitest"

// Tests d'intégration de la gestion des utilisateurs (src/lib/auth/users.ts
// et src/lib/auth/create-user.ts) contre un vrai Postgres local — voir
// src/lib/auth/auth.integration.test.ts pour le contexte général (chargement
// de .env, exécution via `npm run test:integration` uniquement).
//
// Les garde-fous testés (auto-suppression, auto-changement de rôle, dernier
// administrateur) sont ceux appliqués DANS ces fonctions, pas seulement dans
// les Server Actions (src/app/actions/users.ts) — voir le commentaire
// d'en-tête de src/lib/auth/users.ts.

type AuthModule = typeof import("@/lib/auth")
type DbModule = typeof import("@/db")
type SchemaModule = typeof import("@/db/schema")
type UsersModule = typeof import("@/lib/auth/users")
type CreateUserModule = typeof import("@/lib/auth/create-user")

let auth: AuthModule["auth"]
let db: DbModule["db"]
let dbSchema: SchemaModule
let updateUser: UsersModule["updateUser"]
let deleteUser: UsersModule["deleteUser"]
let getUser: UsersModule["getUser"]
let listUsers: UsersModule["listUsers"]
let createUserWithPassword: CreateUserModule["createUserWithPassword"]

// Comptes créés par les tests de ce fichier, à supprimer après coup — même
// logique que createdUserIds dans auth.integration.test.ts. Le compte de
// développement (alex@alexcaron.ca) n'est jamais créé ni supprimé ici.
const createdUserIds: string[] = []

function uniqueEmail(label: string) {
  return `test-integration-${label}-${Date.now()}-${randomUUID().slice(0, 8)}@example.test`
}

beforeAll(async () => {
  try {
    process.loadEnvFile()
  } catch {
    // Pas de fichier .env trouvé : on continue avec l'environnement existant.
  }

  const [authModule, dbModule, schemaModule, usersModule, createUserModule] =
    await Promise.all([
      import("@/lib/auth"),
      import("@/db"),
      import("@/db/schema"),
      import("@/lib/auth/users"),
      import("@/lib/auth/create-user"),
    ])
  auth = authModule.auth
  db = dbModule.db
  dbSchema = schemaModule
  updateUser = usersModule.updateUser
  deleteUser = usersModule.deleteUser
  getUser = usersModule.getUser
  listUsers = usersModule.listUsers
  createUserWithPassword = createUserModule.createUserWithPassword

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
  if (!auth) return

  // Entrées du journal d'audit produites par les tests qui viennent de
  // s'exécuter (user.create/update/delete, voir src/lib/auth/users.ts et
  // src/lib/auth/create-user.ts — et potentiellement auth.login, écrite par
  // le hook databaseHooks.session.create.after de src/lib/auth/index.ts pour
  // les quelques tests ci-dessous qui appellent signInEmail) : toutes
  // référencent un identifiant de createdUserIds, soit comme acteur, soit
  // comme cible — capturé AVANT la boucle de suppression ci-dessous, qui vide
  // le tableau au fur et à mesure.
  if (createdUserIds.length > 0) {
    const idsSnapshot = [...createdUserIds]
    await db
      .delete(dbSchema.auditLog)
      .where(
        or(
          inArray(dbSchema.auditLog.actorId, idsSnapshot),
          inArray(dbSchema.auditLog.targetId, idsSnapshot),
        ),
      )
  }

  const context = await auth.$context
  while (createdUserIds.length > 0) {
    const id = createdUserIds.pop()
    if (id) await context.internalAdapter.deleteUser(id)
  }
})

/**
 * Crée un utilisateur de test en passant par le même chemin interne que
 * scripts/create-admin.ts (context.internalAdapter + context.password.hash),
 * comme les autres fichiers d'intégration — plus direct que
 * createUserWithPassword quand le mot de passe lui-même n'est pas ce qui est
 * testé.
 */
async function createTestUser(label: string, role: "admin" | "member") {
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
  return user
}

/**
 * Rend `keepAdminIds` temporairement les SEULS détenteurs du rôle "admin" en
 * rétrogradant tout autre administrateur existant (y compris, potentiellement,
 * le compte de développement) le temps d'exécuter `fn`, puis restaure
 * systématiquement leur rôle d'origine — même si `fn` lance une erreur.
 *
 * Nécessaire pour tester le garde-fou du dernier administrateur (voir
 * src/lib/auth/users.ts) : ce garde-fou compte les admins sur TOUTE la table
 * `user`, pas seulement les comptes créés par ce fichier — impossible de
 * placer un utilisateur de test en position de "dernier admin" (ou de
 * "avant-dernier", pour le test de concurrence ci-dessous) sans y toucher.
 * Même technique que app-settings.integration.test.ts (capture de l'état
 * réel avant modification, restauration inconditionnelle après) — voir son
 * commentaire d'en-tête.
 */
async function withOnlyAdmins<T>(
  keepAdminIds: string[],
  fn: () => Promise<T>,
): Promise<T> {
  const otherAdmins = await db
    .select({ id: dbSchema.user.id })
    .from(dbSchema.user)
    .where(
      and(eq(dbSchema.user.role, "admin"), notInArray(dbSchema.user.id, keepAdminIds)),
    )

  const otherAdminIds = otherAdmins.map((row) => row.id)

  if (otherAdminIds.length > 0) {
    await db
      .update(dbSchema.user)
      .set({ role: "member" })
      .where(inArray(dbSchema.user.id, otherAdminIds))
  }

  try {
    return await fn()
  } finally {
    if (otherAdminIds.length > 0) {
      await db
        .update(dbSchema.user)
        .set({ role: "admin" })
        .where(inArray(dbSchema.user.id, otherAdminIds))
    }
  }
}

/** Cas à un seul admin restant : voir `withOnlyAdmins` ci-dessus. */
function withSingleAdmin<T>(soloAdminId: string, fn: () => Promise<T>): Promise<T> {
  return withOnlyAdmins([soloAdminId], fn)
}

describe("createUserWithPassword — intégration Postgres", () => {
  it("crée un utilisateur avec mot de passe haché et compte credential lié", async () => {
    const email = uniqueEmail("create-user")

    const created = await createUserWithPassword({
      name: "Nouvel utilisateur",
      email,
      password: "MotDePasse123!",
      role: "member",
      actorId: null,
    })
    createdUserIds.push(created.id)

    expect(created.email).toBe(email)
    expect(created.role).toBe("member")

    const [userRow] = await db
      .select()
      .from(dbSchema.user)
      .where(eq(dbSchema.user.id, created.id))
    expect(userRow?.role).toBe("member")

    const [accountRow] = await db
      .select()
      .from(dbSchema.account)
      .where(eq(dbSchema.account.userId, created.id))
    expect(accountRow?.providerId).toBe("credential")
    expect(accountRow?.password).toBeTruthy()

    // Le mot de passe permet bien de se connecter (hachage compatible avec
    // Better Auth, pas une simple valeur arbitraire).
    await expect(
      auth.api.signInEmail({
        body: { email, password: "MotDePasse123!" },
        headers: new Headers(),
      }),
    ).resolves.toBeDefined()
  })

  it("refuse un courriel déjà utilisé", async () => {
    const email = uniqueEmail("create-user-dup")
    const first = await createUserWithPassword({
      name: "Premier",
      email,
      password: "MotDePasse123!",
      role: "member",
      actorId: null,
    })
    createdUserIds.push(first.id)

    await expect(
      createUserWithPassword({
        name: "Second",
        email,
        password: "AutreMotDePasse123!",
        role: "member",
        actorId: null,
      }),
    ).rejects.toThrow(/existe déjà/i)
  })

  it("refuse un rôle inconnu", async () => {
    const email = uniqueEmail("create-user-bad-role")

    await expect(
      createUserWithPassword({
        name: "Rôle invalide",
        email,
        password: "MotDePasse123!",
        role: "role-qui-nexiste-pas",
        actorId: null,
      }),
    ).rejects.toThrow(/introuvable/i)
  })
})

describe("updateUser — intégration Postgres", () => {
  it("modifie le nom d'un utilisateur", async () => {
    const target = await createTestUser("update-name", "member")
    const actor = await createTestUser("update-name-actor", "admin")

    await updateUser(actor.id, target.id, { name: "Nom modifié" })

    const [row] = await db
      .select({ name: dbSchema.user.name })
      .from(dbSchema.user)
      .where(eq(dbSchema.user.id, target.id))
    expect(row?.name).toBe("Nom modifié")
  })

  it("refuse qu'un utilisateur change son propre rôle", async () => {
    const self = await createTestUser("self-role-change", "member")

    await expect(updateUser(self.id, self.id, { role: "admin" })).rejects.toThrow(
      /propre rôle/i,
    )
  })

  it("refuse de changer vers un rôle inconnu", async () => {
    const target = await createTestUser("update-unknown-role", "member")
    const actor = await createTestUser("update-unknown-role-actor", "admin")

    await expect(
      updateUser(actor.id, target.id, { role: "role-qui-nexiste-pas" }),
    ).rejects.toThrow(/introuvable/i)
  })

  it("refuse de modifier un utilisateur introuvable", async () => {
    const actor = await createTestUser("update-missing-actor", "admin")

    await expect(
      updateUser(actor.id, "id-qui-nexiste-pas", { name: "X" }),
    ).rejects.toThrow(/introuvable/i)
  })

  it("refuse de modifier un utilisateur supprimé (suppression douce) : traité comme introuvable", async () => {
    const target = await createTestUser("update-deleted-target", "member")
    const actor = await createTestUser("update-deleted-target-actor", "admin")

    await deleteUser(actor.id, target.id)

    await expect(
      updateUser(actor.id, target.id, { name: "Nouveau nom" }),
    ).rejects.toThrow(/introuvable/i)
  })

  it("permet de retirer le rôle administrateur quand ce n'est pas le dernier", async () => {
    const extraAdmin = await createTestUser("extra-admin", "admin")
    const actor = await createTestUser("extra-admin-actor", "member")

    // Le compte de développement (ou tout autre admin réel) reste admin :
    // extraAdmin n'est jamais le dernier, l'opération doit donc réussir.
    await updateUser(actor.id, extraAdmin.id, { role: "member" })

    const [row] = await db
      .select({ role: dbSchema.user.role })
      .from(dbSchema.user)
      .where(eq(dbSchema.user.id, extraAdmin.id))
    expect(row?.role).toBe("member")
  })

  it("refuse de retirer le rôle administrateur au dernier administrateur", async () => {
    const soloAdmin = await createTestUser("last-admin-update", "admin")
    const actor = await createTestUser("last-admin-update-actor", "member")

    await withSingleAdmin(soloAdmin.id, async () => {
      await expect(
        updateUser(actor.id, soloAdmin.id, { role: "member" }),
      ).rejects.toThrow(/dernier administrateur/i)
    })

    const [row] = await db
      .select({ role: dbSchema.user.role })
      .from(dbSchema.user)
      .where(eq(dbSchema.user.id, soloAdmin.id))
    expect(row?.role).toBe("admin")
  })
})

describe("deleteUser — intégration Postgres", () => {
  it("supprime EN DOUCEUR un utilisateur : la rangée reste, deleted_at est posé", async () => {
    const target = await createTestUser("delete-member", "member")
    const actor = await createTestUser("delete-member-actor", "admin")

    const before = new Date()
    await deleteUser(actor.id, target.id)

    const [row] = await db
      .select()
      .from(dbSchema.user)
      .where(eq(dbSchema.user.id, target.id))
    expect(row).toBeDefined()
    expect(row?.deletedAt).toBeInstanceOf(Date)
    expect(row!.deletedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime())
  })

  it("révoque immédiatement toutes les sessions actives de l'utilisateur supprimé", async () => {
    const target = await createTestUser("delete-sessions", "member")
    const actor = await createTestUser("delete-sessions-actor", "admin")

    // Deux connexions actives, comme deux appareils (même technique que
    // src/lib/auth/auth.integration.test.ts).
    await auth.api.signInEmail({
      body: { email: target.email, password: "MotDePasse123!" },
      headers: new Headers(),
    })
    await auth.api.signInEmail({
      body: { email: target.email, password: "MotDePasse123!" },
      headers: new Headers(),
    })

    const sessionsBefore = await db
      .select({ id: dbSchema.session.id })
      .from(dbSchema.session)
      .where(eq(dbSchema.session.userId, target.id))
    expect(sessionsBefore.length).toBeGreaterThanOrEqual(2)

    await deleteUser(actor.id, target.id)

    const sessionsAfter = await db
      .select({ id: dbSchema.session.id })
      .from(dbSchema.session)
      .where(eq(dbSchema.session.userId, target.id))
    expect(sessionsAfter).toHaveLength(0)
  })

  it("retire l'utilisateur supprimé de listUsers", async () => {
    const target = await createTestUser("delete-listed", "member")
    const actor = await createTestUser("delete-listed-actor", "admin")

    await deleteUser(actor.id, target.id)

    const users = await listUsers()
    expect(users.some((u) => u.id === target.id)).toBe(false)
  })

  it("refuse qu'un utilisateur se supprime lui-même", async () => {
    const self = await createTestUser("self-delete", "member")

    await expect(deleteUser(self.id, self.id)).rejects.toThrow(/propre compte/i)
  })

  it("refuse de supprimer un utilisateur introuvable", async () => {
    const actor = await createTestUser("delete-missing-actor", "admin")

    await expect(deleteUser(actor.id, "id-qui-nexiste-pas")).rejects.toThrow(
      /introuvable/i,
    )
  })

  it("refuse de supprimer un utilisateur déjà supprimé (traité comme introuvable)", async () => {
    const target = await createTestUser("delete-twice", "member")
    const actor = await createTestUser("delete-twice-actor", "admin")

    await deleteUser(actor.id, target.id)

    await expect(deleteUser(actor.id, target.id)).rejects.toThrow(/introuvable/i)
  })

  it("refuse de supprimer le dernier administrateur", async () => {
    const soloAdmin = await createTestUser("last-admin-delete", "admin")
    const actor = await createTestUser("last-admin-delete-actor", "member")

    await withSingleAdmin(soloAdmin.id, async () => {
      await expect(deleteUser(actor.id, soloAdmin.id)).rejects.toThrow(
        /dernier administrateur/i,
      )
    })

    const [row] = await db
      .select({ id: dbSchema.user.id })
      .from(dbSchema.user)
      .where(eq(dbSchema.user.id, soloAdmin.id))
    expect(row).toBeDefined()
  })

  it("un administrateur supprimé ne compte plus comme administrateur (dernier administrateur ignore les comptes supprimés)", async () => {
    const remainingAdmin = await createTestUser("last-admin-excl-remaining", "admin")
    const actor = await createTestUser("last-admin-excl-actor", "member")

    await withSingleAdmin(remainingAdmin.id, async () => {
      // Avec `remainingAdmin` seul admin réel (les autres sont temporairement
      // rétrogradés par withSingleAdmin), on crée un second admin JETABLE
      // pour former une paire de 2 administrateurs actifs.
      const otherAdmin = await createTestUser("last-admin-excl-other", "admin")

      // Le supprimer (suppression douce) laisse sa rangée `role = 'admin'`
      // intacte en base — seul `deleted_at` change (voir deleteUser
      // ci-dessus). Si le calcul du dernier administrateur ne filtrait pas
      // les comptes supprimés, `remainingAdmin` semblerait encore avoir un
      // collègue administrateur actif : ce test échouerait alors en refusant
      // l'assertion ci-dessous (la suppression de `remainingAdmin`
      // réussirait au lieu d'être bloquée).
      await deleteUser(actor.id, otherAdmin.id)

      await expect(deleteUser(actor.id, remainingAdmin.id)).rejects.toThrow(
        /dernier administrateur/i,
      )
    })
  })
})

describe("getUser — intégration Postgres", () => {
  it("lit un utilisateur par identifiant", async () => {
    const target = await createTestUser("get-user", "member")

    const found = await getUser(target.id)

    expect(found).toEqual({
      id: target.id,
      name: target.name,
      email: target.email,
      role: "member",
    })
  })

  it("retourne null pour un identifiant introuvable", async () => {
    await expect(getUser("id-qui-nexiste-pas")).resolves.toBeNull()
  })

  it("retourne null pour un utilisateur supprimé (suppression douce)", async () => {
    const target = await createTestUser("get-user-deleted", "member")
    const actor = await createTestUser("get-user-deleted-actor", "admin")

    await deleteUser(actor.id, target.id)

    await expect(getUser(target.id)).resolves.toBeNull()
  })
})

// Garde-fou anti-course (TOCTOU) du dernier administrateur — voir
// `lockAndCountAdmins` dans src/lib/auth/users.ts pour le détail du
// mécanisme (SELECT ... FOR UPDATE). Ces deux tests déclenchent RÉELLEMENT
// deux transactions Postgres concurrentes (Promise.allSettled, pas
// séquentiel) contre les deux mêmes administrateurs — sans le verrou, les
// deux compteraient "2 admins" avant que l'une des deux n'ait terminé, et
// les DEUX passeraient le garde-fou. Non flaky par construction : `FOR
// UPDATE` fait bloquer la seconde transaction jusqu'à ce que la première
// valide, PUIS lui fait relire l'état réel des rangées (sémantique
// EvalPlanQual de Postgres en READ COMMITTED) — l'issue (une réussite, un
// échec) est donc déterministe, jamais dépendante d'un minutage précis.
describe("Protection anti-course du dernier administrateur — intégration Postgres", () => {
  it("deleteUser : sur 2 derniers admins supprimés en même temps, exactement un échoue", async () => {
    const adminA = await createTestUser("concurrent-delete-a", "admin")
    const adminB = await createTestUser("concurrent-delete-b", "admin")
    const actor = await createTestUser("concurrent-delete-actor", "member")

    await withOnlyAdmins([adminA.id, adminB.id], async () => {
      const [resultA, resultB] = await Promise.allSettled([
        deleteUser(actor.id, adminA.id),
        deleteUser(actor.id, adminB.id),
      ])

      const outcomes = [resultA, resultB]
      const succeeded = outcomes.filter((r) => r.status === "fulfilled")
      const failed = outcomes.filter((r) => r.status === "rejected")

      expect(succeeded).toHaveLength(1)
      expect(failed).toHaveLength(1)
      expect(String((failed[0] as PromiseRejectedResult).reason)).toMatch(
        /dernier administrateur/i,
      )

      // Restaure l'admin dont la suppression a réussi : withOnlyAdmins ne
      // restaure que les rôles qu'IL a changés (les "autres" admins réels),
      // pas les conséquences de fn() elle-même — sans quoi le nettoyage
      // final (afterEach, hard delete via l'adaptateur interne) resterait
      // correct, mais l'état intermédiaire (un admin de test supprimé) ne
      // doit pas fuiter au-delà de ce test.
      const deletedId = resultA.status === "fulfilled" ? adminA.id : adminB.id
      await db
        .update(dbSchema.user)
        .set({ deletedAt: null })
        .where(eq(dbSchema.user.id, deletedId))
    })
  })

  it("updateUser : sur 2 derniers admins rétrogradés en même temps, exactement un échoue", async () => {
    const adminA = await createTestUser("concurrent-update-a", "admin")
    const adminB = await createTestUser("concurrent-update-b", "admin")
    const actor = await createTestUser("concurrent-update-actor", "member")

    await withOnlyAdmins([adminA.id, adminB.id], async () => {
      const [resultA, resultB] = await Promise.allSettled([
        updateUser(actor.id, adminA.id, { role: "member" }),
        updateUser(actor.id, adminB.id, { role: "member" }),
      ])

      const outcomes = [resultA, resultB]
      const succeeded = outcomes.filter((r) => r.status === "fulfilled")
      const failed = outcomes.filter((r) => r.status === "rejected")

      expect(succeeded).toHaveLength(1)
      expect(failed).toHaveLength(1)
      expect(String((failed[0] as PromiseRejectedResult).reason)).toMatch(
        /dernier administrateur/i,
      )

      // Restaure l'admin dont la rétrogradation a réussi, pour ne pas fuiter
      // d'état "member" au-delà de ce test (même raison que ci-dessus).
      const demotedId = resultA.status === "fulfilled" ? adminA.id : adminB.id
      await db
        .update(dbSchema.user)
        .set({ role: "admin" })
        .where(eq(dbSchema.user.id, demotedId))
    })
  })
})
