import { randomUUID } from "node:crypto"
import { eq, sql } from "drizzle-orm"
import { afterEach, beforeAll, describe, expect, it } from "vitest"

// Tests d'intégration du rate limiting explicite, sur ses deux couches :
//
//   - Better Auth (rateLimit dans src/lib/auth/index.ts), pour les requêtes qui
//     passent par son routeur HTTP (auth.handler). L'instance de
//     l'application ne l'active qu'en production
//     (rateLimit.enabled: process.env.NODE_ENV === "production"), donc elle
//     reste inactive pendant ces tests (Vitest définit NODE_ENV="test"). On
//     construit ici une instance Better Auth dédiée — même secret, même URL
//     de base, même adaptateur Postgres que l'application — mais avec
//     rateLimit.enabled forcé à true et une limite volontairement basse sur
//     /sign-in/email, pour observer un vrai 429 sans dizaines de
//     tentatives.
//
//   - src/lib/auth/rate-limit.ts (enforceRateLimit / consumeRateLimit), pour les
//     Server Actions (src/app/actions/auth.ts) qui appellent auth.api.*
//     directement et contournent donc le routeur ci-dessus — voir le
//     commentaire en tête de src/app/actions/auth.ts. `consumeRateLimit`
//     est testée directement (pas `enforceRateLimit`) car elle n'est pas
//     soumise à RATE_LIMIT_ENABLED, ce qui permet d'exercer le vrai
//     comportement de stockage sans dépendre de NODE_ENV.
//
// Comme src/lib/auth/auth.integration.test.ts, ceci nécessite un vrai Postgres
// local (voir DATABASE_URL dans .env, port 5433 par défaut) et n'est
// exécuté que par `npm run test:integration`.

type AuthModule = typeof import("@/lib/auth")
type DbModule = typeof import("@/db")
type SchemaModule = typeof import("@/db/schema")
type BetterAuthModule = typeof import("better-auth/minimal")
type RateLimitModule = typeof import("@/lib/auth/rate-limit")

let auth: AuthModule["auth"]
let db: DbModule["db"]
let dbSchema: SchemaModule
let testAuth: ReturnType<BetterAuthModule["betterAuth"]>
let consumeRateLimit: RateLimitModule["consumeRateLimit"]
let decideRateLimit: RateLimitModule["decideRateLimit"]

// Chemin de l'endpoint Better Auth soumis à la règle personnalisée testée
// (voir customRules["/sign-in/email"] dans src/lib/auth/index.ts et ci-dessous).
const RATE_LIMITED_PATH = "/sign-in/email"

// getIp() (node_modules/@better-auth/core/src/utils/ip.ts) retombe sur
// 127.0.0.1 quand aucun en-tête x-forwarded-for de confiance n'est fourni
// et que NODE_ENV vaut "test" ou "development" — ce que Vitest définit par
// défaut. La clé du compteur est donc déterministe pour toutes les requêtes
// de ce fichier, ce qui permet de la nettoyer précisément après coup.
const RATE_LIMIT_KEY = `127.0.0.1|${RATE_LIMITED_PATH}`

// Comptes créés par les tests de ce fichier, à supprimer après coup (même
// logique que src/lib/auth/auth.integration.test.ts).
const createdUserIds: string[] = []

// Clés (rule:ip) créées par les tests de consumeRateLimit dans la table
// rate_limit, à supprimer après coup.
const consumedKeys: string[] = []

function uniqueEmail(label: string) {
  return `test-integration-${label}-${Date.now()}-${randomUUID().slice(0, 8)}@example.test`
}

function uniqueRule(label: string) {
  return `test-integration-${label}-${Date.now()}-${randomUUID().slice(0, 8)}`
}

beforeAll(async () => {
  try {
    process.loadEnvFile()
  } catch {
    // Pas de fichier .env trouvé (ex. variables déjà fournies par
    // l'environnement) : on continue avec l'environnement existant, comme
    // scripts/create-admin.ts.
  }

  const [
    authModule,
    dbModule,
    schemaModule,
    envModule,
    betterAuthModule,
    drizzleAdapterModule,
    rateLimitModule,
  ] = await Promise.all([
    import("@/lib/auth"),
    import("@/db"),
    import("@/db/schema"),
    import("@/lib/env"),
    import("better-auth/minimal"),
    import("better-auth/adapters/drizzle"),
    import("@/lib/auth/rate-limit"),
  ])

  auth = authModule.auth
  db = dbModule.db
  dbSchema = schemaModule
  consumeRateLimit = rateLimitModule.consumeRateLimit
  decideRateLimit = rateLimitModule.decideRateLimit

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

  testAuth = betterAuthModule.betterAuth({
    baseURL: envModule.env.BETTER_AUTH_URL,
    secret: envModule.env.BETTER_AUTH_SECRET,
    database: drizzleAdapterModule.drizzleAdapter(db, {
      provider: "pg",
      schema: schemaModule,
    }),
    emailAndPassword: { enabled: true, disableSignUp: true },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        // Même chemin qu'en production, mais une limite de 3 (au lieu de
        // 10) pour que le test reste rapide et déterministe.
        [RATE_LIMITED_PATH]: { window: 60, max: 3 },
      },
    },
  })
}, 20_000)

afterEach(async () => {
  if (auth) {
    const context = await auth.$context
    while (createdUserIds.length > 0) {
      const id = createdUserIds.pop()
      if (id) await context.internalAdapter.deleteUser(id)
    }
  }

  // Rangée de compteur créée par le test Better Auth dans la table
  // rate_limit (voir src/db/schema.ts) : on ne supprime que la clé utilisée
  // par ce fichier, jamais toute la table.
  await db.delete(dbSchema.rateLimit).where(eq(dbSchema.rateLimit.key, RATE_LIMIT_KEY))

  // Rangées créées par les tests de consumeRateLimit, une clé unique par
  // test (voir uniqueRule).
  while (consumedKeys.length > 0) {
    const key = consumedKeys.pop()
    if (key) await db.delete(dbSchema.rateLimit).where(eq(dbSchema.rateLimit.key, key))
  }
})

/**
 * Crée un utilisateur de test en passant par l'instance réelle de
 * l'application (même chemin interne que scripts/create-admin.ts), pour
 * ensuite tenter de se connecter au travers de `testAuth`, dont la seule
 * différence de configuration est le rate limiting.
 */
async function createTestUser(label: string, password: string) {
  const context = await auth.$context
  const email = uniqueEmail(label)
  const hashedPassword = await context.password.hash(password)

  const user = await context.internalAdapter.createUser({
    name: `Utilisateur de test (${label})`,
    email,
    emailVerified: true,
    role: "member",
  })
  await context.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: hashedPassword,
  })

  createdUserIds.push(user.id)
  return { ...user, password }
}

describe("Rate limiting — intégration Postgres", () => {
  it("bloque la connexion avec un code 429 après plusieurs tentatives échouées", async () => {
    const user = await createTestUser("rate-limit-signin", "MotDePasse123!")
    const context = await testAuth.$context

    const signIn = (password: string) =>
      testAuth.handler(
        new Request(`${context.baseURL}${RATE_LIMITED_PATH}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: user.email, password }),
        }),
      )

    // Les 3 premières tentatives sont traitées normalement (mauvais mot de
    // passe -> 401) : la règle personnalisée autorise jusqu'à 3 requêtes
    // par minute sur /sign-in/email (voir customRules ci-dessus).
    for (let i = 0; i < 3; i++) {
      const response = await signIn("mauvais-mot-de-passe")
      expect(response.status).toBe(401)
    }

    // La 4e tentative dépasse la limite : Better Auth répond 429 avant même
    // d'évaluer les identifiants.
    const limited = await signIn("mauvais-mot-de-passe")
    expect(limited.status).toBe(429)
    expect(limited.headers.get("x-retry-after")).toBeTruthy()
    expect(await limited.json()).toMatchObject({
      message: expect.stringContaining("Too many requests"),
    })

    // Le bon mot de passe échoue aussi tant que la fenêtre n'est pas
    // écoulée : preuve que la limite s'applique par IP+route, pas par
    // tentative individuelle de mot de passe.
    const evenWithGoodPassword = await signIn(user.password)
    expect(evenWithGoodPassword.status).toBe(429)
  })
})

describe("consumeRateLimit — stockage Postgres (Server Actions)", () => {
  it("incrémente le compteur à chaque appel dans la fenêtre", async () => {
    const rule = uniqueRule("increment")
    consumedKeys.push(`${rule}:127.0.0.1`)

    const first = await consumeRateLimit(rule, "127.0.0.1", { window: 60 })
    const second = await consumeRateLimit(rule, "127.0.0.1", { window: 60 })
    const third = await consumeRateLimit(rule, "127.0.0.1", { window: 60 })

    expect(first.count).toBe(1)
    expect(second.count).toBe(2)
    expect(third.count).toBe(3)
  })

  it("bloque une fois le compteur au-delà de la limite configurée", async () => {
    const rule = uniqueRule("max")
    consumedKeys.push(`${rule}:127.0.0.1`)
    const max = 2

    const first = await consumeRateLimit(rule, "127.0.0.1", { window: 60 })
    const second = await consumeRateLimit(rule, "127.0.0.1", { window: 60 })
    const third = await consumeRateLimit(rule, "127.0.0.1", { window: 60 })

    expect(decideRateLimit(first.count, max)).toEqual({ limited: false })
    expect(decideRateLimit(second.count, max)).toEqual({ limited: false })
    expect(decideRateLimit(third.count, max)).toEqual({ limited: true })
  })

  it("réinitialise le compteur une fois la fenêtre écoulée", async () => {
    const rule = uniqueRule("expiry")
    consumedKeys.push(`${rule}:127.0.0.1`)
    // Fenêtre volontairement très courte pour observer une vraie
    // expiration sans ralentir la suite de tests.
    const window = 1

    const first = await consumeRateLimit(rule, "127.0.0.1", { window })
    const second = await consumeRateLimit(rule, "127.0.0.1", { window })
    expect(first.count).toBe(1)
    expect(second.count).toBe(2)

    await new Promise((resolve) => setTimeout(resolve, (window + 0.2) * 1000))

    const afterExpiry = await consumeRateLimit(rule, "127.0.0.1", { window })
    expect(afterExpiry.count).toBe(1)
  })

  it("isole les compteurs par clé (rule:ip) : deux règles n'interfèrent pas", async () => {
    const ruleA = uniqueRule("isolation-a")
    const ruleB = uniqueRule("isolation-b")
    consumedKeys.push(`${ruleA}:127.0.0.1`, `${ruleB}:127.0.0.1`)

    await consumeRateLimit(ruleA, "127.0.0.1", { window: 60 })
    await consumeRateLimit(ruleA, "127.0.0.1", { window: 60 })
    const resultB = await consumeRateLimit(ruleB, "127.0.0.1", { window: 60 })

    expect(resultB.count).toBe(1)
  })
})
