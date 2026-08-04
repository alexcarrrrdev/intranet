import { randomUUID } from "node:crypto"
import { sql } from "drizzle-orm"
import { headers } from "next/headers"

import { db } from "@/db"

// Politique d'activation du rate limiting, PARTAGÉE entre deux mécanismes
// distincts qui ne doivent jamais diverger :
//   - src/lib/auth/index.ts (rateLimit.enabled), pour les requêtes qui passent par
//     le routeur HTTP de Better Auth (auth.handler) ;
//   - enforceRateLimit ci-dessous, pour les Server Actions qui appellent
//     auth.api.* directement et contournent donc ce routeur (voir le
//     commentaire en tête de src/app/actions/auth.ts).
// Une seule constante exportée évite qu'une des deux moitiés soit activée
// sans l'autre. Comme pour Better Auth, désactivé en développement pour ne
// pas gêner les tests manuels répétés.
export const RATE_LIMIT_ENABLED = process.env.NODE_ENV === "production"

export type RateLimitRule = {
  /** Fenêtre glissante, en secondes. */
  window: number
  /** Nombre maximal de requêtes autorisées dans la fenêtre. */
  max: number
}

export type RateLimitDecision = { limited: boolean }

/**
 * Dérive une clé client à partir des en-têtes d'une requête. Volontairement
 * simple par rapport à la résolution d'IP de Better Auth (voir getIp dans
 * node_modules/@better-auth/core/src/utils/ip.ts, qui gère les proxys de
 * confiance, IPv6, etc.) : les Server Actions n'ont pas accès à un objet
 * Request complet, seulement à next/headers().
 *
 * Séparée de `getClientKey` (qui lit next/headers()) pour rester testable
 * sans contexte de requête Next.js — voir src/lib/auth/rate-limit.test.ts.
 */
export function deriveClientKey(headerList: Pick<Headers, "get">): string {
  const forwardedFor = headerList.get("x-forwarded-for")
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim()
    if (first) return first
  }

  const realIp = headerList.get("x-real-ip")?.trim()
  if (realIp) return realIp

  return "unknown"
}

async function getClientKey(): Promise<string> {
  return deriveClientKey(await headers())
}

/**
 * Logique de décision pure — extraite de `enforceRateLimit` pour être
 * testée indépendamment de NODE_ENV et de la base de données : un compteur
 * dépasse la limite dès qu'il excède `max`.
 */
export function decideRateLimit(count: number, max: number): RateLimitDecision {
  return { limited: count > max }
}

/**
 * Incrémente (ou initialise) le compteur de la clé `${rule}:${ip}` dans la
 * table `rate_limit` (voir src/db/schema.ts, partagée avec Better Auth) et
 * retourne le compteur résultant.
 *
 * Une seule requête SQL atomique (INSERT ... ON CONFLICT ... RETURNING),
 * plutôt qu'une lecture suivie d'une écriture séparée (comme le fait le
 * stockage "database" de Better Auth, voir createDatabaseStorageWrapper
 * dans node_modules/better-auth/dist/api/rate-limiter/index.mjs) : deux
 * requêtes concurrentes ne peuvent pas toutes les deux lire un compteur
 * périmé avant qu'aucune n'ait encore écrit, ce qui laisserait passer plus
 * de tentatives que la limite configurée.
 *
 * Fenêtre glissante par activité, comme Better Auth : `last_request` est
 * remis à jour à chaque appel, et le compteur ne repart à 1 que si aucune
 * requête n'est arrivée depuis plus de `window` secondes. Au-delà de `max`,
 * le compteur continue d'augmenter (on ne « dé-consomme » pas une requête
 * bloquée) : la fenêtre ne peut donc pas être débloquée par inactivité tant
 * que l'attaquant continue d'essayer.
 *
 * Exportée séparément d'`enforceRateLimit` pour permettre de tester le
 * comportement de stockage contre la vraie table, indépendamment de
 * RATE_LIMIT_ENABLED (qui désactive tout en dehors de la production) — voir
 * src/lib/auth/rate-limit.integration.test.ts.
 */
export async function consumeRateLimit(
  rule: string,
  ip: string,
  { window }: Pick<RateLimitRule, "window">,
): Promise<{ count: number }> {
  const key = `${rule}:${ip}`
  const now = Date.now()
  const windowMs = window * 1000
  const id = randomUUID()

  const result = await db.execute<{ count: number }>(sql`
    INSERT INTO rate_limit (id, key, count, last_request)
    VALUES (${id}, ${key}, 1, ${now})
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN ${now} - rate_limit.last_request > ${windowMs} THEN 1
        ELSE rate_limit.count + 1
      END,
      last_request = ${now}
    RETURNING count
  `)

  const row = result.rows[0]
  return { count: row ? Number(row.count) : 1 }
}

/**
 * Point d'entrée utilisé par les Server Actions (src/app/actions/auth.ts).
 * Sans objet : désactivé en dehors de la production (voir
 * RATE_LIMIT_ENABLED), comme le rate limiting HTTP de Better Auth. Le
 * chemin le plus rapide (désactivé) ne touche pas la base de données.
 */
export async function enforceRateLimit(
  rule: string,
  { window, max }: RateLimitRule,
): Promise<RateLimitDecision> {
  if (!RATE_LIMIT_ENABLED) {
    return { limited: false }
  }

  const ip = await getClientKey()
  const { count } = await consumeRateLimit(rule, ip, { window })
  return decideRateLimit(count, max)
}
