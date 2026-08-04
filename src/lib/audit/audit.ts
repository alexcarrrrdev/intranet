/**
 * Journal d'audit : trace des actions administratives (voir la table
 * `audit_log` dans src/db/schema.ts, avec le détail de chaque colonne). Ce
 * fichier est le SEUL point d'entrée autorisé à y écrire — WRITE-ONLY par
 * conception : aucune fonction de mise à jour ni de suppression n'y est
 * exposée, volontairement (voir le commentaire de `auditLog` dans
 * src/db/schema.ts).
 *
 * Volontairement PAS enregistrés dans ce journal :
 *   - les tentatives de connexion ÉCHOUÉES : un tiers qui essaierait des
 *     mots de passe au hasard sur un compte connu pourrait sinon inonder le
 *     journal d'entrées inutiles. La limitation de débit
 *     (src/lib/auth/rate-limit.ts, règle "/sign-in/email") réduit ce risque
 *     sans l'éliminer : elle limite par IP, pas par compte visé — un
 *     attaquant distribué (plusieurs IP) resterait sous le seuil par IP tout
 *     en générant beaucoup de bruit s'il était journalisé. Seule la
 *     connexion RÉUSSIE (auth.login) est donc tracée ;
 *   - les demandes de réinitialisation de mot de passe (forgotPasswordAction,
 *     src/app/actions/auth.ts) : même risque d'inondation, PLUS un risque
 *     propre au journal lui-même — cette action répond volontairement de la
 *     même façon qu'un courriel corresponde ou non à un compte existant
 *     (anti-énumération de comptes, voir son commentaire). L'enregistrer
 *     recréerait cette fuite dans le journal : une simple demande (pas même
 *     un lien cliqué) y confirmerait la présence d'un compte pour ce
 *     courriel.
 */
import { randomUUID } from "node:crypto"
import { and, desc, eq, sql, type ExtractTablesWithRelations } from "drizzle-orm"
import type { NodePgTransaction } from "drizzle-orm/node-postgres"

import { db } from "@/db"
import * as schema from "@/db/schema"
import { auditLog, user } from "@/db/schema"
import { AUDIT_ACTIONS, type AuditAction } from "@/lib/audit/actions"

// Réexportés pour que le reste du code serveur (Server Actions, pages, lib/*)
// continue de tout importer depuis ce fichier — voir src/lib/audit/actions.ts
// pour pourquoi le catalogue lui-même vit dans un fichier séparé (SANS import
// de @/db, contrairement à celui-ci) : c'est ce fichier-CI qui parle à
// Postgres, jamais le catalogue seul.
export { AUDIT_ACTIONS, type AuditAction }

// Exécuteur accepté par les fonctions d'écriture ci-dessous : soit `db`
// directement, soit une transaction (`tx`, le paramètre reçu par le callback
// de `db.transaction(...)`). Les appelants À L'INTÉRIEUR d'une transaction
// (ex. src/lib/auth/users.ts) DOIVENT passer leur `tx` — jamais `db` — pour
// que l'entrée de journal et l'action qu'elle décrit valident ou soient
// annulées ENSEMBLE : une action qui échoue (rollback) ne doit laisser
// AUCUNE entrée de journal, sans quoi celui-ci mentirait sur ce qui s'est
// réellement produit (voir les tests d'atomicité dans
// src/lib/auth/users.integration.test.ts).
export type AuditExecutor =
  | typeof db
  | NodePgTransaction<typeof schema, ExtractTablesWithRelations<typeof schema>>

/**
 * Construit le cliché "Nom (courriel)" d'un acteur au moment d'une action, à
 * partir de son seul identifiant — voir `actorLabel` dans src/db/schema.ts
 * pour pourquoi ce cliché existe plutôt qu'une jointure sur `user`. Une seule
 * requête, faite avec le MÊME exécuteur que l'action auditée (donc dans la
 * même transaction quand il y en a une), pour lire une version cohérente du
 * nom/courriel — pas une lecture séparée qui pourrait voir un état différent.
 *
 * `actorId` nul (ex. scripts/create-admin.ts, exécuté hors de toute session)
 * donne "Système", jamais une erreur. Un identifiant fourni mais introuvable
 * (cas limite, ex. course avec une suppression concurrente) retombe sur un
 * libellé neutre plutôt que de faire échouer l'action auditée pour cette
 * seule raison — la trace reste utile même incomplète.
 */
export async function resolveActorLabel(
  executor: AuditExecutor,
  actorId: string | null,
): Promise<string> {
  if (!actorId) return "Système"

  const [row] = await executor
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, actorId))
    .limit(1)

  return row ? `${row.name} (${row.email})` : "Utilisateur inconnu"
}

export type AuditEntryInput = {
  actorId: string | null
  actorLabel: string
  action: AuditAction
  targetType?: string | null
  targetId?: string | null
  targetLabel?: string
  details?: Record<string, unknown> | null
}

/**
 * Enregistre une entrée dans le journal d'audit — voir `AuditExecutor`
 * ci-dessus pour le choix entre `db` et une transaction.
 *
 * Revalide `entry.action` contre `AUDIT_ACTIONS` à l'exécution, même si le
 * type `AuditAction` le garantit déjà à la compilation pour un appelant
 * TypeScript honnête : un appelant pourrait contourner ce typage (valeur
 * dynamique construite ailleurs, `as AuditAction`), et cette table ne doit
 * JAMAIS contenir de clé d'action absente du catalogue — l'interface
 * (/administration/journal) n'a de libellé français que pour celles-ci.
 */
export async function recordAudit(
  executor: AuditExecutor,
  entry: AuditEntryInput,
): Promise<void> {
  if (!(entry.action in AUDIT_ACTIONS)) {
    throw new Error(`Action d'audit inconnue : « ${entry.action} ».`)
  }

  await executor.insert(auditLog).values({
    id: randomUUID(),
    actorId: entry.actorId,
    actorLabel: entry.actorLabel,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    targetLabel: entry.targetLabel ?? "",
    details: entry.details ?? null,
  })
}

export type AuditListFilter = {
  page?: number
  perPage?: number
  action?: string
  actorId?: string
}

export type AuditEntryRow = {
  id: string
  createdAt: Date
  actorId: string | null
  actorLabel: string
  action: string
  targetType: string | null
  targetId: string | null
  targetLabel: string
  details: unknown
}

export type AuditListResult = {
  entries: AuditEntryRow[]
  total: number
  page: number
  perPage: number
}

export const DEFAULT_AUDIT_PER_PAGE = 20

/**
 * Liste les entrées du journal, les plus récentes en premier, avec
 * pagination et filtres optionnels (action, acteur) — pour
 * /administration/journal. `total` compte l'ensemble des rangées
 * correspondant aux filtres, PAS seulement la page courante : c'est ce qui
 * permet à l'interface de calculer le nombre de pages (voir
 * src/components/administration/audit-log-table.tsx).
 *
 * `action`/`actorId` sont acceptés comme de simples chaînes (pas
 * restreintes à `AuditAction`) : ils viennent des paramètres d'URL de la
 * page (`?action=`, `?acteur=`), potentiellement arbitraires — une valeur
 * qui ne correspond à aucune rangée retourne simplement une liste vide,
 * sans qu'il soit nécessaire de la valider au préalable.
 */
export async function listAuditEntries(
  filter: AuditListFilter = {},
): Promise<AuditListResult> {
  const page = filter.page && filter.page > 0 ? Math.floor(filter.page) : 1
  const perPage =
    filter.perPage && filter.perPage > 0 ? Math.floor(filter.perPage) : DEFAULT_AUDIT_PER_PAGE

  const conditions = []
  if (filter.action) conditions.push(eq(auditLog.action, filter.action))
  if (filter.actorId) conditions.push(eq(auditLog.actorId, filter.actorId))
  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [entries, totalRows] = await Promise.all([
    db
      .select()
      .from(auditLog)
      .where(where)
      .orderBy(desc(auditLog.createdAt))
      .limit(perPage)
      .offset((page - 1) * perPage),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLog)
      .where(where),
  ])

  return {
    entries,
    total: totalRows[0]?.count ?? 0,
    page,
    perPage,
  }
}

export type ActorOption = {
  id: string
  label: string
}

/**
 * Liste les acteurs distincts présents dans le journal (identifiant + leur
 * libellé le plus RÉCENT), pour peupler le filtre "Acteur" de
 * /administration/journal. Construite à partir du journal lui-même plutôt
 * que de `listUsers()` (src/lib/auth/users.ts) : un acteur depuis supprimé
 * reste filtrable sur son historique passé, ce que la liste des seuls
 * utilisateurs actifs ne permettrait pas — voir le commentaire de `actorId`
 * dans src/db/schema.ts. Exclut "Système" (`actorId` NULL) : il n'y a rien à
 * filtrer par identifiant pour lui, il reste visible tel quel dans la
 * colonne "Acteur" de chaque entrée.
 */
export async function listDistinctActors(): Promise<ActorOption[]> {
  const rows = await db
    .selectDistinctOn([auditLog.actorId], {
      actorId: auditLog.actorId,
      actorLabel: auditLog.actorLabel,
    })
    .from(auditLog)
    .where(sql`${auditLog.actorId} IS NOT NULL`)
    // DISTINCT ON garde la première rangée de chaque groupe `actor_id` selon
    // cet ordre : trier par date décroissante donne donc le libellé le plus
    // récent. Postgres exige que les colonnes de DISTINCT ON soient un
    // préfixe de ORDER BY, d'où `actorId` en premier ici aussi.
    .orderBy(auditLog.actorId, desc(auditLog.createdAt))

  return rows
    .filter((row): row is { actorId: string; actorLabel: string } => row.actorId !== null)
    .map((row) => ({ id: row.actorId, label: row.actorLabel }))
    .sort((a, b) => a.label.localeCompare(b.label, "fr"))
}
