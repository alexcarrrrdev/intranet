/**
 * Modèle de permissions granulaires (ressource × action), résolu
 * dynamiquement depuis la base de données (tables `role` et
 * `role_permission`, voir src/db/schema.ts).
 *
 * `statement` reste LE catalogue de ce qui existe dans l'application :
 * chaque ressource et chaque action qu'elle accepte doit y être déclarée.
 * Les rôles, eux, ne sont plus codés en dur ici — ils sont gérés
 * dynamiquement (voir src/lib/auth/roles.ts) et leurs permissions vivent en
 * base, avec un cas particulier pour "admin" (voir getPermissionsForRole
 * ci-dessous).
 *
 * Comment ajouter une ressource :
 *   1. Ajouter une entrée à `statement` ci-dessous avec la liste de ses
 *      actions.
 *   2. Ajouter ses libellés français à `resourceLabels`/`actionLabels`.
 *   3. Accorder (ou non) cette ressource aux rôles existants depuis
 *      /administration/utilisateurs — "admin" l'aura automatiquement
 *      (court-circuit), les autres rôles ne l'auront pas tant qu'un
 *      administrateur ne la leur accorde pas explicitement.
 *
 * Comment ajouter un rôle : voir src/lib/auth/roles.ts (createRole). Un rôle
 * n'est qu'une rangée en base ; aucune modification de ce fichier n'est
 * nécessaire.
 */
import { cache } from "react";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { rolePermission } from "@/db/schema";

// Statement : liste des ressources et des actions possibles sur chacune.
// Gardé volontairement petit pour ce template, mais facile à étendre.
export const statement = {
  user: ["create", "read", "update", "delete"],
  settings: ["read", "update"],
  // Gérer les rôles (créer/modifier/supprimer des rôles personnalisés,
  // modifier leurs permissions) est lui-même une permission : voir
  // src/lib/auth/roles.ts et src/app/actions/roles.ts.
  role: ["create", "read", "update", "delete"],
  // Consulter le journal d'audit (/administration/journal, voir
  // src/lib/audit/audit.ts) : une seule action, "read" — le journal est
  // write-only par conception (voir src/db/schema.ts), aucune permission
  // create/update/delete n'a donc de sens ici. "admin" l'a automatiquement
  // (court-circuit ci-dessous) ; aucun autre rôle ne l'a par défaut, un
  // administrateur doit l'accorder explicitement depuis /administration/roles.
  audit: ["read"],
} as const;

export type Resource = keyof typeof statement;
export type Action<R extends Resource> = (typeof statement)[R][number];

// Chaîne de permission au format "ressource:action" (ex. "user:create"),
// telle que stockée dans `role_permission.permission`.
export type PermissionString = {
  [R in Resource]: `${R}:${Action<R>}`;
}[Resource];

// Libellés français des ressources et actions du catalogue, utilisés par
// l'UI d'administration des rôles pour afficher une matrice de permissions
// lisible plutôt que des chaînes brutes "resource:action".
export const resourceLabels: Record<Resource, string> = {
  user: "Utilisateurs",
  settings: "Paramètres",
  role: "Rôles",
  audit: "Journal d'audit",
};

export const actionLabels: Record<Action<Resource>, string> = {
  create: "Créer",
  read: "Consulter",
  update: "Modifier",
  delete: "Supprimer",
};

// Libellés de repli pour les deux rôles système, utilisés uniquement quand
// le nom réel du rôle (colonne `role.name`, voir src/lib/auth/roles.ts)
// n'est pas disponible dans le contexte courant. Partout où la rangée du
// rôle a déjà été lue, préférer `role.name` à ces libellés statiques : eux
// seuls reflètent un éventuel renommage du rôle "member" (voir
// updateRole).
export const roleLabels: Record<string, string> = {
  admin: "Administrateur",
  member: "Membre",
};

/** Identifiant du rôle administrateur : voir le court-circuit ci-dessous. */
export const ADMIN_ROLE_ID = "admin";

/**
 * Identifiant du rôle membre : rôle par défaut de `user.role` (voir
 * src/db/schema.ts), qui ne peut donc jamais être supprimé (voir
 * src/lib/auth/roles.ts).
 */
export const MEMBER_ROLE_ID = "member";

/**
 * Construit l'ensemble complet des permissions du catalogue
 * ("resource:action" pour chaque ressource et chaque action déclarées dans
 * `statement`). Fonction pure, sans accès base de données : utilisée à la
 * fois pour le court-circuit de l'administrateur (ci-dessous) et pour
 * valider qu'un ensemble de permissions soumis par l'UI ne contient que des
 * valeurs connues (voir src/lib/auth/roles.ts).
 */
export function getAllPermissions(): Set<PermissionString> {
  const all = new Set<PermissionString>();
  for (const resource of Object.keys(statement) as Resource[]) {
    for (const action of statement[resource]) {
      all.add(`${resource}:${action}` as PermissionString);
    }
  }
  return all;
}

/** Vérifie qu'une chaîne correspond bien à une permission du catalogue. */
export function isValidPermission(value: string): value is PermissionString {
  return getAllPermissions().has(value as PermissionString);
}

type SessionUser = { role?: string | null } | null | undefined;

/**
 * Résout l'ensemble des permissions accordées à un rôle (par son
 * identifiant, ex. "admin", "member", ou un rôle personnalisé).
 *
 * Cas particulier : le rôle "admin" court-circuite toute lecture en base et
 * reçoit systématiquement l'ensemble COMPLET du catalogue (`statement`),
 * y compris les ressources ajoutées en code après coup — c'est le rôle
 * système qui a, par définition, accès à tout. Sa table `role_permission`
 * ne contient d'ailleurs aucune rangée (voir la migration 0005) : la
 * source de vérité de ses permissions est le code, pas la base.
 *
 * Pour tout autre rôle, une seule requête sur `role_permission`. Un rôle
 * inconnu, supprimé, ou une valeur null/undefined renvoie un ensemble vide
 * plutôt que de lancer une erreur.
 *
 * Mémorisée avec `cache()` de React : une même requête HTTP peut vérifier
 * plusieurs permissions du même rôle (ex. filtrage de la barre latérale
 * puis vérification d'accès à la page) sans déclencher une requête par
 * vérification. Comme pour getCurrentSession (src/lib/auth/session.ts), la
 * mémorisation ne dure que le temps de la requête : un changement de rôle
 * s'applique dès la prochaine requête de l'utilisateur concerné (voir la
 * note sur les sessions plus bas).
 */
export const getPermissionsForRole = cache(async function getPermissionsForRole(
  roleId: string | null | undefined,
): Promise<Set<PermissionString>> {
  if (!roleId) return new Set();

  if (roleId === ADMIN_ROLE_ID) return getAllPermissions();

  const rows = await db
    .select({ permission: rolePermission.permission })
    .from(rolePermission)
    .where(eq(rolePermission.roleId, roleId));

  return new Set(rows.map((row) => row.permission as PermissionString));
});

/**
 * Résout l'ensemble des permissions accordées à un utilisateur de session
 * (typiquement `session.user`). Un utilisateur absent (null/undefined)
 * n'a aucune permission.
 *
 * Note sur les sessions : le rôle est lu depuis la rangée `user` à chaque
 * requête (Better Auth relit `getSession` à chaque appel serveur, voir
 * src/lib/auth/session.ts), pas depuis un jeton mis en cache côté client —
 * un changement de rôle (ou des permissions d'un rôle) s'applique donc dès
 * la prochaine requête de l'utilisateur concerné, sans qu'il ait besoin de
 * se reconnecter.
 */
export async function getGrantedPermissions(
  user: SessionUser,
): Promise<Set<PermissionString>> {
  return getPermissionsForRole(user?.role);
}

/**
 * Vérifie si un utilisateur possède la permission demandée sur une
 * ressource. Retourne `false` (plutôt que de lancer une erreur) si
 * l'utilisateur est absent ou si son rôle n'accorde pas cette permission.
 */
export async function hasPermission<R extends Resource>(
  user: SessionUser,
  resource: R,
  action: Action<R>,
): Promise<boolean> {
  const granted = await getGrantedPermissions(user);
  return granted.has(`${resource}:${action}` as PermissionString);
}

/**
 * Variante « stricte » de `hasPermission`, destinée aux Server Actions et
 * Route Handlers : lance une erreur si la permission est manquante, ce qui
 * interrompt l'exécution de l'action en cours.
 */
export async function requirePermission<R extends Resource>(
  user: SessionUser,
  resource: R,
  action: Action<R>,
): Promise<void> {
  if (!(await hasPermission(user, resource, action))) {
    throw new Error(
      `Permission refusée : l'action « ${action} » sur « ${resource} » requiert des droits supplémentaires.`,
    );
  }
}
