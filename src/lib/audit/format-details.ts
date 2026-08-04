/**
 * Formatage compact (français) de la colonne "Détails" du journal d'audit
 * (/administration/journal — voir src/components/administration/
 * audit-log-table.tsx) : transforme le JSON brut stocké dans
 * `audit_log.details` (voir chaque site d'appel de `recordAudit` dans
 * src/lib/audit/audit.ts pour sa forme exacte) en une poignée de courtes
 * phrases lisibles, propres à chaque action.
 *
 * Fonction PURE (aucun accès base de données, aucune dépendance à `action` au
 * delà d'une chaîne) : c'est ce qui la rend testable sans Postgres — voir
 * format-details.test.ts, un cas par type d'action.
 *
 * Défensive par nécessité : `details` vient de la base sous forme de JSON non
 * typé (`unknown` — Drizzle ne connaît pas sa forme, voir `details: jsonb(...)`
 * dans src/db/schema.ts). Une valeur inattendue (action future non gérée
 * ci-dessous, entrée malformée) ne doit jamais faire planter la page :
 * silencieusement ignorée, ligne absente plutôt qu'une exception.
 */

type Diff = { before: unknown; after: unknown }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isDiff(value: unknown): value is Diff {
  return isRecord(value) && "before" in value && "after" in value
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

/** "« avant » → « après »", ou `null` si `value` n'a pas la forme d'un diff. */
function formatDiff(label: string, value: unknown): string | null {
  if (!isDiff(value)) return null
  return `${label} : « ${String(value.before)} » → « ${String(value.after)} »`
}

/** Taille lisible d'un fichier, en octets ou kilo-octets selon sa grandeur. */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  return `${Math.round(bytes / 1024)} Ko`
}

/**
 * Formate le détail d'une entrée du journal en une liste de courtes phrases,
 * une par élément notable du diff (ex. `["nom : « A » → « B »", "rôle :
 * « member » → « admin »"]`). Tableau vide si `details` est absent, ou si
 * l'action n'a aucun rendu défini ci-dessous (auth.login, session.revoke...).
 */
export function formatAuditDetails(action: string, details: unknown): string[] {
  if (!isRecord(details)) return []

  const lines: string[] = []

  switch (action) {
    case "user.create": {
      if (typeof details.role === "string") {
        lines.push(`rôle : ${details.role}`)
      }
      break
    }

    case "user.update": {
      const name = formatDiff("nom", details.name)
      if (name) lines.push(name)
      const role = formatDiff("rôle", details.role)
      if (role) lines.push(role)
      break
    }

    case "role.create": {
      if (isStringArray(details.permissions) && details.permissions.length > 0) {
        lines.push(`permissions : ${details.permissions.join(", ")}`)
      }
      break
    }

    case "role.update": {
      const name = formatDiff("nom", details.name)
      if (name) lines.push(name)
      const description = formatDiff("description", details.description)
      if (description) lines.push(description)

      const added = isStringArray(details.permissionsAdded) ? details.permissionsAdded : []
      const removed = isStringArray(details.permissionsRemoved) ? details.permissionsRemoved : []
      if (added.length > 0 || removed.length > 0) {
        const tokens = [...added.map((p) => `+${p}`), ...removed.map((p) => `−${p}`)]
        lines.push(`permissions ${tokens.join(" ")}`)
      }
      break
    }

    case "settings.app_name.update": {
      const appName = formatDiff("nom de l'application", details.appName)
      if (appName) lines.push(appName)
      break
    }

    case "settings.logo.update": {
      if (typeof details.mimeType === "string" && typeof details.size === "number") {
        lines.push(`logo : ${details.mimeType}, ${formatFileSize(details.size)}`)
      }
      break
    }

    case "settings.primary_color.update": {
      const primaryColor = formatDiff("couleur principale", details.primaryColor)
      if (primaryColor) lines.push(primaryColor)
      break
    }

    case "auth.password.change": {
      if (details.revokedOtherSessions === true) {
        lines.push("autres sessions révoquées")
      }
      break
    }

    case "profile.name.update": {
      const name = formatDiff("nom", details.name)
      if (name) lines.push(name)
      break
    }

    case "session.revoke_others": {
      if (typeof details.revokedCount === "number") {
        lines.push(`sessions révoquées : ${details.revokedCount}`)
      }
      break
    }

    default:
      break
  }

  return lines
}
