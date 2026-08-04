/**
 * Normalisation d'un identifiant de rôle (slug), extraite de
 * src/lib/auth/roles.ts pour être un module PUR (aucun import de
 * src/db/*) : src/lib/auth/roles.ts touche la base de données (via `db`),
 * donc ne peut pas être importé depuis un composant client (le bundler
 * embarquerait le pilote `pg`, qui dépend de modules Node absents du
 * navigateur). La page /administration/roles (composant client
 * role-form-dialog.tsx) a besoin de cette même normalisation pour
 * prévisualiser le slug pendant la saisie du nom — voir son commentaire.
 *
 * src/lib/auth/roles.ts réexporte `slugify` depuis ce fichier pour garder
 * une API publique inchangée (voir src/lib/auth/roles.test.ts).
 */

// Identifiant de rôle : lettres minuscules, chiffres et tirets, entre 2 et
// 50 caractères (voir aussi src/lib/auth/role-schemas.ts, qui applique la
// même règle côté formulaire).
export const SLUG_PATTERN = /^[a-z0-9-]{2,50}$/

/**
 * Dérive un identifiant de rôle (slug) à partir de son nom : minuscules,
 * accents retirés, tout ce qui n'est pas [a-z0-9] remplacé par un tiret,
 * tirets superflus retirés. Ex. "Support Client" -> "support-client".
 */
export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
