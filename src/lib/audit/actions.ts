/**
 * Catalogue des actions journalisables (voir src/lib/audit/audit.ts pour
 * `recordAudit`, qui valide chaque écriture contre ce catalogue) et leur
 * libellé français, affiché dans l'interface
 * (/administration/journal — voir
 * src/components/administration/audit-log-table.tsx).
 *
 * Extrait dans son propre fichier, SANS aucun import de src/db/* : ce
 * catalogue est un simple objet, utile aussi bien côté serveur (validation,
 * pages) que côté client (le composant `"use client"` AuditLogTable en a
 * besoin pour peupler le filtre "Action"). src/lib/audit/audit.ts, lui,
 * importe `@/db` (le pool de connexions PostgreSQL, voir src/db/index.ts) —
 * un composant client qui importerait AUDIT_ACTIONS depuis audit.ts
 * entraînerait tout ce module (et donc le driver `pg`) dans le bundle
 * navigateur, qui échoue à la compilation (modules Node natifs comme `net`,
 * `tls`, `fs` absents du navigateur). Vérifié empiriquement : `npm run
 * build` échouait ainsi avant cette séparation.
 *
 * Pour ajouter une nouvelle action : l'ajouter ici avec son libellé, puis
 * appeler `recordAudit` (src/lib/audit/audit.ts) depuis le bon site (à
 * l'intérieur de sa transaction si elle en a une). Si elle produit un détail
 * structuré, ajouter aussi son rendu dans src/lib/audit/format-details.ts.
 */
export const AUDIT_ACTIONS = {
  "user.create": "Création d'un utilisateur",
  "user.update": "Modification d'un utilisateur",
  "user.delete": "Suppression d'un utilisateur",
  "role.create": "Création d'un rôle",
  "role.update": "Modification d'un rôle",
  "role.delete": "Suppression d'un rôle",
  "settings.app_name.update": "Modification du nom de l'application",
  "settings.logo.update": "Modification du logo",
  "settings.logo.delete": "Retrait du logo",
  "settings.primary_color.update": "Modification de la couleur principale",
  "settings.primary_color.delete": "Réinitialisation de la couleur principale",
  "auth.login": "Connexion",
  "auth.password.change": "Changement de mot de passe",
  "auth.password.reset": "Réinitialisation de mot de passe",
  "profile.name.update": "Modification du nom (profil)",
  "profile.avatar.update": "Modification de la photo de profil",
  "profile.avatar.delete": "Retrait de la photo de profil",
  "session.revoke": "Révocation d'une session",
  "session.revoke_others": "Révocation des autres sessions",
  "announcement.create": "Création d'une annonce",
  "announcement.pin": "Épinglage d'une annonce",
  "announcement.unpin": "Désépinglage d'une annonce",
  "announcement.delete": "Suppression d'une annonce",
  "event.create": "Création d'un événement",
  "event.delete": "Suppression d'un événement",
  "group.create": "Création d'un groupe",
  "group.delete": "Suppression d'un groupe",
  "group.invite": "Invitation à un groupe",
} as const satisfies Record<string, string>

export type AuditAction = keyof typeof AUDIT_ACTIONS
