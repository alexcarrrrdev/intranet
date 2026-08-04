/**
 * Gestion des rôles applicatifs (table `role`, voir src/db/schema.ts) : la
 * partie « écriture » du modèle de permissions dont la partie « lecture »
 * (résolution des permissions d'un utilisateur) vit dans
 * src/lib/auth/permissions.ts.
 *
 * Les règles métier ci-dessous sont appliquées ICI, pas seulement dans l'UI
 * (phase future) ou les Server Actions (src/app/actions/roles.ts) : un appel
 * direct à ces fonctions (ex. depuis un script ou un test) ne peut pas les
 * contourner.
 */
import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { role, rolePermission, user } from "@/db/schema";
import {
  ADMIN_ROLE_ID,
  MEMBER_ROLE_ID,
  getPermissionsForRole,
  isValidPermission,
  type PermissionString,
} from "@/lib/auth/permissions";
import { SLUG_PATTERN, slugify } from "@/lib/auth/slug";
import { recordAudit, resolveActorLabel } from "@/lib/audit/audit";

// `slugify`/`SLUG_PATTERN` vivent dans src/lib/auth/slug.ts (module pur,
// sans import de src/db/*) plutôt qu'ici : la page /administration/roles a
// besoin de la même normalisation pour prévisualiser le slug côté client, ce
// que ce fichier-ci ne permet pas (il touche la base de données). Réexporté
// ci-dessous pour garder l'API publique de ce module inchangée.
export { slugify };

/**
 * Vérifie si une erreur correspond à une violation de contrainte de clé
 * étrangère Postgres (code "23503"). Drizzle enrobe l'erreur brute du
 * pilote `pg` dans une `DrizzleQueryError` (voir
 * node_modules/drizzle-orm/errors.js), qui expose l'erreur d'origine via
 * `.cause` plutôt que de recopier `.code` sur elle-même — on regarde donc
 * les deux niveaux plutôt que de supposer une forme d'erreur particulière.
 */
function pgErrorCode(value: unknown): unknown {
  return typeof value === "object" && value !== null && "code" in value
    ? (value as { code?: unknown }).code
    : undefined;
}

// Codes SQLSTATE Postgres (classe 23, violation de contrainte d'intégrité)
// pouvant survenir en supprimant un rôle encore référencé par `user.role` :
//   - 23503 foreign_key_violation : cas général d'une clé étrangère ON
//     DELETE (NO ACTION par défaut) ;
//   - 23001 restrict_violation : cas précis d'une clé étrangère déclarée
//     ON DELETE RESTRICT, comme `user_role_role_id_fk` (voir
//     src/db/schema.ts) — c'est celui que Postgres lève réellement ici,
//     vérifié empiriquement (RESTRICT et NO ACTION diffèrent seulement dans
//     le timing de la vérification, pas dans le code d'erreur).
const RESTRICT_VIOLATION_CODES = new Set(["23503", "23001"]);

function isForeignKeyViolation(error: unknown): boolean {
  const code = pgErrorCode(error);
  if (typeof code === "string" && RESTRICT_VIOLATION_CODES.has(code)) return true;

  if (error instanceof Error) {
    const causeCode = pgErrorCode(error.cause);
    return typeof causeCode === "string" && RESTRICT_VIOLATION_CODES.has(causeCode);
  }

  return false;
}

function assertValidPermissions(permissions: string[]): void {
  for (const permission of permissions) {
    if (!isValidPermission(permission)) {
      throw new Error(`Permission inconnue : « ${permission} ».`);
    }
  }
}

export type RoleListItem = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
};

/**
 * Liste tous les rôles avec, pour chacun, le nombre d'utilisateurs qui
 * l'utilisent actuellement — une seule requête (LEFT JOIN + GROUP BY),
 * plutôt qu'une requête de comptage par rôle.
 */
export async function listRoles(): Promise<RoleListItem[]> {
  return db
    .select({
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      userCount: sql<number>`count(${user.id})::int`,
    })
    .from(role)
    .leftJoin(user, eq(user.role, role.id))
    .groupBy(role.id)
    .orderBy(role.name);
}

export type RoleDetail = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: PermissionString[];
};

/**
 * Lit un rôle avec l'ensemble de ses permissions. Délègue la résolution des
 * permissions à `getPermissionsForRole` (src/lib/auth/permissions.ts), qui
 * court-circuite "admin" vers le catalogue complet plutôt que de lire
 * `role_permission` (qui ne contient aucune rangée pour lui) — voir son
 * commentaire pour le détail.
 */
export async function getRole(id: string): Promise<RoleDetail | null> {
  const [row] = await db.select().from(role).where(eq(role.id, id)).limit(1);
  if (!row) return null;

  const permissions = await getPermissionsForRole(row.id);

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isSystem: row.isSystem,
    permissions: Array.from(permissions),
  };
}

/**
 * Résout l'identifiant final d'un rôle en cours de création : celui fourni
 * explicitement (validé), ou dérivé du nom via `slugify`. Lance une erreur
 * française si le résultat ne respecte pas SLUG_PATTERN — mais PAS la même
 * selon la provenance du slug invalide :
 *   - un identifiant explicite invalide (usage script/API : le formulaire
 *     /administration/roles n'expose plus de champ "identifiant", voir
 *     createRole ci-dessous) garde le message technique, orienté
 *     "identifiant" ;
 *   - un identifiant DÉRIVÉ du nom (aucun identifiant fourni) et invalide —
 *     typiquement un nom sans aucune lettre ni chiffre, ex. "!!!", qui donne
 *     une chaîne vide après `slugify` (voir src/lib/auth/slug.ts) — ne doit
 *     JAMAIS mentionner "identifiant" : ce concept n'est pas visible dans le
 *     formulaire, l'utilisateur n'a que le champ "nom" sous les yeux, c'est
 *     donc lui que le message doit désigner.
 */
function resolveNewRoleId(id: string | undefined, name: string): string {
  const explicitId = id?.trim();

  if (explicitId) {
    if (!SLUG_PATTERN.test(explicitId)) {
      throw new Error(
        "Identifiant de rôle invalide : uniquement des lettres minuscules, des chiffres et des tirets, entre 2 et 50 caractères.",
      );
    }
    return explicitId;
  }

  const derived = slugify(name);
  if (!SLUG_PATTERN.test(derived)) {
    throw new Error(
      "Le nom du rôle doit contenir au moins une lettre ou un chiffre.",
    );
  }

  return derived;
}

export type CreateRoleInput = {
  id?: string;
  name: string;
  description?: string | null;
  permissions: string[];
};

/**
 * Crée un rôle personnalisé (jamais "admin" ni "member", déjà occupés par
 * les rôles système insérés par la migration 0005). Les permissions sont
 * validées contre le catalogue (`statement`, src/lib/auth/permissions.ts) :
 * toute chaîne qui n'y correspond pas fait échouer la création entière.
 *
 * `actorId` : identifiant de l'administrateur à l'origine de la création,
 * pour le journal d'audit (voir recordAudit ci-dessous — même mécanisme que
 * src/lib/auth/users.ts : l'exécuteur de la transaction résout lui-même le
 * libellé de l'acteur via `resolveActorLabel`, une seule requête).
 */
export async function createRole(actorId: string, input: CreateRoleInput): Promise<RoleDetail> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Le nom du rôle est requis.");
  }

  const id = resolveNewRoleId(input.id, name);
  const permissions = Array.from(new Set(input.permissions));
  assertValidPermissions(permissions);

  const existing = await getRole(id);
  if (existing) {
    // Message orienté « nom » : l'identifiant technique (dérivé du nom) n'est
    // plus exposé dans le formulaire, il ne doit donc pas apparaître comme
    // concept dans les messages destinés à l'utilisateur.
    throw new Error(
      `Un rôle au nom similaire (« ${existing.name} ») existe déjà. Choisissez un autre nom.`,
    );
  }

  const description = input.description?.trim() || null;

  await db.transaction(async (tx) => {
    await tx.insert(role).values({ id, name, description, isSystem: false });
    if (permissions.length > 0) {
      await tx
        .insert(rolePermission)
        .values(permissions.map((permission) => ({ roleId: id, permission })));
    }

    const actorLabel = await resolveActorLabel(tx, actorId);
    await recordAudit(tx, {
      actorId,
      actorLabel,
      action: "role.create",
      targetType: "role",
      targetId: id,
      targetLabel: `Rôle ${name}`,
      details: { permissions },
    });
  });

  return { id, name, description, isSystem: false, permissions: permissions as PermissionString[] };
}

export type UpdateRoleInput = {
  name?: string;
  description?: string | null;
  permissions?: string[];
};

/**
 * Met à jour un rôle existant. "admin" ne peut jamais être modifié (son
 * accès complet vient d'un court-circuit dans le code, pas d'une rangée
 * `role_permission` — le modifier n'aurait de toute façon aucun effet, mais
 * on le refuse explicitement pour ne pas laisser croire le contraire).
 * "member" reste modifiable : seule sa suppression est interdite (voir
 * `deleteRole`), car c'est le rôle par défaut de tout nouvel utilisateur.
 *
 * `actorId` : voir le commentaire de `createRole` ci-dessus.
 */
export async function updateRole(
  actorId: string,
  id: string,
  input: UpdateRoleInput,
): Promise<RoleDetail> {
  if (id === ADMIN_ROLE_ID) {
    throw new Error("Le rôle Administrateur ne peut pas être modifié.");
  }

  const existing = await getRole(id);
  if (!existing) {
    throw new Error("Ce rôle est introuvable.");
  }

  const name = input.name !== undefined ? input.name.trim() : existing.name;
  if (!name) {
    throw new Error("Le nom du rôle est requis.");
  }

  const description =
    input.description !== undefined
      ? input.description?.trim() || null
      : existing.description;

  const permissions = input.permissions
    ? Array.from(new Set(input.permissions))
    : existing.permissions;

  if (input.permissions) {
    assertValidPermissions(permissions);
  }

  // Diff avant/après pour le journal d'audit — voir
  // src/lib/audit/format-details.ts pour son rendu dans l'interface.
  const auditDetails: Record<string, unknown> = {};
  if (input.name !== undefined && name !== existing.name) {
    auditDetails.name = { before: existing.name, after: name };
  }
  if (input.description !== undefined && description !== existing.description) {
    auditDetails.description = { before: existing.description, after: description };
  }
  if (input.permissions) {
    const before = new Set(existing.permissions);
    const after = new Set(permissions);
    const added = permissions.filter((p) => !before.has(p as PermissionString));
    const removed = existing.permissions.filter((p) => !after.has(p));
    if (added.length > 0) auditDetails.permissionsAdded = added;
    if (removed.length > 0) auditDetails.permissionsRemoved = removed;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(role)
      .set({ name, description, updatedAt: new Date() })
      .where(eq(role.id, id));

    if (input.permissions) {
      await tx.delete(rolePermission).where(eq(rolePermission.roleId, id));
      if (permissions.length > 0) {
        await tx
          .insert(rolePermission)
          .values(permissions.map((permission) => ({ roleId: id, permission })));
      }
    }

    const actorLabel = await resolveActorLabel(tx, actorId);
    await recordAudit(tx, {
      actorId,
      actorLabel,
      action: "role.update",
      targetType: "role",
      targetId: id,
      targetLabel: `Rôle ${name}`,
      details: auditDetails,
    });
  });

  return { id, name, description, isSystem: existing.isSystem, permissions: permissions as PermissionString[] };
}

/**
 * Supprime un rôle personnalisé. "admin" et "member" ne peuvent jamais être
 * supprimés (rôles système). Un rôle personnalisé encore utilisé par au
 * moins un utilisateur ne peut pas non plus être supprimé — imposé au
 * niveau base de données (contrainte ON DELETE RESTRICT sur `user.role`,
 * voir src/db/schema.ts) ; l'erreur brute de Postgres est interceptée ici
 * pour être remplacée par un message français indiquant combien
 * d'utilisateurs bloquent la suppression.
 *
 * `actorId` : voir le commentaire de `createRole` ci-dessus. La suppression
 * elle-même et son entrée d'audit sont désormais dans une transaction (elles
 * ne l'étaient pas avant l'ajout du journal) : si la contrainte de clé
 * étrangère bloque le DELETE, la transaction est annulée et AUCUNE entrée
 * n'est écrite — cohérent avec `deleteUser`/`updateUser`
 * (src/lib/auth/users.ts) et le reste des garde-fous de ce module.
 */
export async function deleteRole(actorId: string, id: string): Promise<void> {
  if (id === ADMIN_ROLE_ID) {
    throw new Error("Le rôle Administrateur ne peut pas être supprimé.");
  }
  if (id === MEMBER_ROLE_ID) {
    throw new Error(
      "Le rôle Membre ne peut pas être supprimé : c'est le rôle par défaut des nouveaux utilisateurs.",
    );
  }

  const existing = await getRole(id);
  if (!existing) {
    throw new Error("Ce rôle est introuvable.");
  }

  try {
    await db.transaction(async (tx) => {
      await tx.delete(role).where(eq(role.id, id));

      const actorLabel = await resolveActorLabel(tx, actorId);
      await recordAudit(tx, {
        actorId,
        actorLabel,
        action: "role.delete",
        targetType: "role",
        targetId: id,
        targetLabel: `Rôle ${existing.name}`,
      });
    });
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(user)
        .where(eq(user.role, id));

      throw new Error(
        count > 1
          ? `Impossible de supprimer ce rôle : ${count} utilisateurs l'utilisent encore.`
          : `Impossible de supprimer ce rôle : ${count} utilisateur l'utilise encore.`,
      );
    }
    throw error;
  }
}
