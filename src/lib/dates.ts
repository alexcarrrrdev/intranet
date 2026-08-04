/**
 * Formatage des dates pour l'intranet (fil, calendrier, annonces...), en
 * français canadien (locale `fr-CA`). Regroupe :
 *   - `formatRelativeTime` : temps relatif court (« à l'instant », « il y a
 *     5 min », « il y a 2 h », « hier », sinon une date courte) — utilisé
 *     sous chaque publication/commentaire du fil.
 *   - `formatShortDate`/`formatShortDateTime`/`formatTime` : formatages
 *     absolus utiles au calendrier (date courte, date + heure, heure seule).
 *
 * Toutes les fonctions acceptent `Date | string | number` (une valeur issue
 * de Drizzle est déjà un `Date`, mais accepter aussi une chaîne/un timestamp
 * évite un `new Date(...)` répété à chaque site d'appel).
 */

type DateInput = Date | string | number;

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Retourne `true` si `a` et `b` tombent le même jour calendaire (heure locale). */
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Temps relatif court en français, calculé par rapport à `now` (par défaut
 * l'instant présent — paramètre exposé surtout pour les tests, voir
 * dates.test.ts).
 *
 * Paliers :
 *   - < 1 min       → « à l'instant »
 *   - < 1 h         → « il y a X min »
 *   - < 24 h        → « il y a X h »
 *   - hier (jour civil précédent) → « hier »
 *   - au-delà       → date courte (`formatShortDate`)
 *
 * Une date future (horloge cliente légèrement en avance, ex.) retombe aussi
 * sur « à l'instant » plutôt que d'afficher une durée négative.
 */
export function formatRelativeTime(value: DateInput, now: DateInput = new Date()): string {
  const date = toDate(value);
  const reference = toDate(now);
  const diffMs = reference.getTime() - date.getTime();

  if (diffMs < MINUTE_MS) return "à l'instant";
  if (diffMs < HOUR_MS) return `il y a ${Math.floor(diffMs / MINUTE_MS)} min`;
  if (diffMs < DAY_MS) return `il y a ${Math.floor(diffMs / HOUR_MS)} h`;

  const yesterday = new Date(reference.getTime() - DAY_MS);
  if (isSameDay(date, yesterday)) return "hier";

  return formatShortDate(date);
}

/** Date courte fr-CA, ex. « 4 août 2026 ». */
export function formatShortDate(value: DateInput): string {
  return toDate(value).toLocaleDateString("fr-CA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Heure seule fr-CA, ex. « 14 h 30 » (déjà le format natif de `Intl` ici). */
export function formatTime(value: DateInput): string {
  return toDate(value).toLocaleTimeString("fr-CA", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Date + heure courtes fr-CA, ex. « 4 août 2026 à 14 h 30 ». */
export function formatShortDateTime(value: DateInput): string {
  return `${formatShortDate(value)} à ${formatTime(value)}`;
}

/** Jour numérique (ex. « 4 »), utilisé pour le bloc de date du calendrier. */
export function formatDayOfMonth(value: DateInput): string {
  return toDate(value).toLocaleDateString("fr-CA", { day: "numeric" });
}

/** Mois abrégé (ex. « août »), utilisé pour le bloc de date du calendrier. */
export function formatShortMonth(value: DateInput): string {
  return toDate(value).toLocaleDateString("fr-CA", { month: "short" }).replace(".", "");
}
