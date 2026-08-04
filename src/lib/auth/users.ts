/**
 * Gestion des utilisateurs (liste, modification, suppression) depuis
 * /administration/utilisateurs. La création passe par un chemin distinct
 * (src/lib/auth/create-user.ts), car elle implique Better Auth (hachage du
 * mot de passe, création du compte "credential") — ce fichier-ci ne
 * manipule que la table `user` déjà existante, via Drizzle directement.
 *
 * Comme src/lib/auth/roles.ts, les garde-fous ci-dessous sont appliqués ICI,
 * pas seulement dans les Server Actions (src/app/actions/users.ts) : un
 * appel direct à ces fonctions ne peut pas les contourner.
 */
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { role, session, user } from "@/db/schema";
import { ADMIN_ROLE_ID } from "@/lib/auth/permissions";
import { recordAudit, resolveActorLabel } from "@/lib/audit/audit";

export type UserListItem = {
  id: string;
  name: string;
  email: string;
  role: string;
  roleName: string;
  createdAt: Date;
};

/**
 * Liste tous les utilisateurs avec le nom d'affichage de leur rôle (jointure
 * sur `role`, plutôt qu'un aller-retour séparé par utilisateur).
 *
 * Exclut les utilisateurs supprimés (`deleted_at` non NULL, voir
 * `deleteUser` ci-dessous) : une suppression est douce (la rangée reste en
 * base), mais elle ne doit apparaître nulle part dans l'interface.
 */
export async function listUsers(): Promise<UserListItem[]> {
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      roleName: role.name,
      createdAt: user.createdAt,
    })
    .from(user)
    .innerJoin(role, eq(user.role, role.id))
    .where(isNull(user.deletedAt))
    .orderBy(user.name);
}

export type UserDetail = {
  id: string;
  name: string;
  email: string;
  role: string;
};

/**
 * Lit un utilisateur par identifiant, pour la page
 * /administration/utilisateurs/[id] (formulaire de modification) — mêmes
 * conventions que `getRole` dans src/lib/auth/roles.ts : `null` si absent,
 * plutôt qu'une erreur, pour laisser l'appelant décider de l'affichage
 * (« Utilisateur introuvable »). Pas de jointure sur `role` ici : le
 * formulaire d'édition reçoit déjà la liste complète des rôles (via
 * `listRoles()`) pour son sélecteur, il n'a pas besoin du nom d'affichage.
 *
 * Exclut, comme `listUsers`, les utilisateurs supprimés : un utilisateur
 * supprimé doit apparaître comme introuvable, pas comme modifiable.
 */
export async function getUser(id: string): Promise<UserDetail | null> {
  const [row] = await db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role })
    .from(user)
    .where(and(eq(user.id, id), isNull(user.deletedAt)))
    .limit(1);
  return row ?? null;
}

/**
 * Verrouille (SELECT ... FOR UPDATE) puis compte les utilisateurs actifs
 * (non supprimés) ayant le rôle "admin". Utilisée pour empêcher de retirer
 * le dernier accès administrateur de l'application (voir `updateUser` et
 * `deleteUser` ci-dessous) — DOIT être appelée à l'intérieur de la
 * transaction qui décide de retirer le rôle admin ou de supprimer un compte
 * admin, jamais en dehors.
 *
 * Le verrou (et non un simple COUNT) est ce qui ferme la course suivante
 * (TOCTOU) : deux administrateurs A et B, exactement 2 admins au total, deux
 * requêtes concurrentes rétrogradent/suppriment chacune un des deux. Avec un
 * simple COUNT non verrouillé, les deux transactions peuvent lire "2 admins"
 * AVANT que l'une des deux n'ait validé sa modification — les deux passent
 * alors le garde-fou (adminCount > 1), et l'application se retrouve sans
 * aucun administrateur. `FOR UPDATE` verrouille toutes les rangées
 * actuellement admin : la seconde transaction à atteindre cette requête
 * bloque jusqu'à ce que la première valide (ou annule), PUIS relit l'état
 * réel des rangées verrouillées — si la première a effectivement changé le
 * rôle de sa cible, cette rangée ne correspond plus au prédicat
 * `role = 'admin'` et est exclue du résultat : la seconde transaction voit
 * donc le compte À JOUR (1), pas le compte périmé (2), et refuse à son tour.
 *
 * `orderBy(user.id)` : verrouiller plusieurs rangées avec FOR UPDATE sans
 * ordre garanti expose à un interblocage (deadlock) si deux transactions
 * concurrentes les verrouillaient dans un ordre différent (A prend d'abord
 * la rangée d'admin1, B prend d'abord celle d'admin2, chacune attend
 * ensuite l'autre indéfiniment). Trier explicitement force TOUTE
 * transaction qui passe par cette fonction à demander les verrous dans le
 * même ordre : la seconde bloque toujours sur la MÊME rangée (la première
 * du tri) que la transaction qui la précède, jamais sur une rangée
 * différente — l'issue reste donc « une bloque, l'autre continue »,
 * jamais un interblocage.
 */
async function lockAndCountAdmins(
  executor: Pick<typeof db, "select">,
): Promise<number> {
  const rows = await executor
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.role, ADMIN_ROLE_ID), isNull(user.deletedAt)))
    .orderBy(user.id)
    .for("update");
  return rows.length;
}

export type UpdateUserInput = {
  name?: string;
  role?: string;
};

/**
 * Met à jour le nom et/ou le rôle d'un utilisateur.
 *
 * Garde-fous (appliqués même si l'appelant — la Server Action — a déjà
 * vérifié la permission `user:update` du demandeur) :
 *   - un utilisateur ne peut pas changer son propre rôle (`actingUserId`
 *     === `id` et `role` fourni), pour éviter qu'il ne se verrouille
 *     lui-même hors de l'administration ;
 *   - si la cible a actuellement le rôle "admin" et que son rôle change
 *     vers autre chose, l'opération est refusée si elle est la DERNIÈRE
 *     admin — sans quoi l'application n'aurait plus aucun administrateur.
 *
 * La vérification du nombre d'admins et la mise à jour sont faites dans la
 * même transaction, et cette vérification verrouille désormais les rangées
 * admin concernées (voir `lockAndCountAdmins` ci-dessus) avant de compter :
 * une simple lecture non verrouillée serait vulnérable à une course entre
 * deux rétrogradations concurrentes (voir son commentaire pour le détail).
 *
 * Refuse aussi sur une cible déjà supprimée (suppression douce, voir
 * `deleteUser`) : `deleted_at` non NULL se comporte comme un utilisateur
 * introuvable, jamais comme un utilisateur modifiable.
 */
export async function updateUser(
  actingUserId: string,
  id: string,
  input: UpdateUserInput,
): Promise<void> {
  if (input.role !== undefined && id === actingUserId) {
    throw new Error("Vous ne pouvez pas modifier votre propre rôle.");
  }

  await db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: user.id, name: user.name, email: user.email, role: user.role })
      .from(user)
      .where(and(eq(user.id, id), isNull(user.deletedAt)))
      .limit(1);
    if (!target) {
      throw new Error("Cet utilisateur est introuvable.");
    }

    const patch: { name?: string; role?: string; updatedAt?: Date } = {};
    // Diff avant/après pour le journal d'audit (voir recordAudit ci-dessous)
    // — seulement pour les champs réellement fournis, jamais pour un champ
    // absent de `input`.
    const auditDetails: Record<string, { before: string; after: string }> = {};

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) {
        throw new Error("Le nom est requis.");
      }
      patch.name = name;
      auditDetails.name = { before: target.name, after: name };
    }

    if (input.role !== undefined && input.role !== target.role) {
      const [roleRow] = await tx
        .select({ id: role.id })
        .from(role)
        .where(eq(role.id, input.role))
        .limit(1);
      if (!roleRow) {
        throw new Error("Ce rôle est introuvable.");
      }

      if (target.role === ADMIN_ROLE_ID) {
        const adminCount = await lockAndCountAdmins(tx);
        if (adminCount <= 1) {
          throw new Error(
            "Impossible de retirer le rôle administrateur : c'est le dernier administrateur de l'application.",
          );
        }
      }

      patch.role = input.role;
      auditDetails.role = { before: target.role, after: input.role };
    }

    if (Object.keys(patch).length === 0) return;

    patch.updatedAt = new Date();
    await tx.update(user).set(patch).where(eq(user.id, id));

    const actorLabel = await resolveActorLabel(tx, actingUserId);
    await recordAudit(tx, {
      actorId: actingUserId,
      actorLabel,
      action: "user.update",
      targetType: "user",
      targetId: id,
      targetLabel: `${patch.name ?? target.name} (${target.email})`,
      details: auditDetails,
    });
  });
}

/**
 * Supprime (en douceur) un utilisateur. Un utilisateur ne peut pas se
 * supprimer lui-même, ni supprimer le dernier administrateur (mêmes raisons
 * que `updateUser` ci-dessus, et même verrouillage anti-course via
 * `lockAndCountAdmins`).
 *
 * Suppression DOUCE plutôt qu'un DELETE : `deleted_at` est simplement posé à
 * la date courante, la rangée `user` reste en base (voir son commentaire
 * dans src/db/schema.ts). Deux conséquences traitées explicitement, dans la
 * MÊME transaction :
 *   - la contrainte ON DELETE CASCADE de `session` (déclarée dans
 *     src/db/schema.ts) ne se déclenche que sur un vrai DELETE de la rangée
 *     `user` — puisqu'elle n'est plus supprimée, elle ne se déclenche plus.
 *     On supprime donc les sessions explicitement ci-dessous : un compte
 *     désactivé ne doit plus pouvoir naviguer l'application avec une session
 *     déjà ouverte, et ce IMMÉDIATEMENT (pas seulement à l'expiration
 *     naturelle de la session) ;
 *   - `account` (mot de passe haché) N'EST PAS supprimé : il n'a pas besoin
 *     de l'être pour empêcher la connexion (voir le hook
 *     `databaseHooks.session.create.before` dans src/lib/auth/index.ts, qui
 *     bloque la création de session pour un utilisateur supprimé avant même
 *     que le mot de passe ne soit vérifié) — le conserver permet une
 *     éventuelle restauration manuelle (mettre `deleted_at` à NULL en base)
 *     sans devoir recréer le compte credential.
 *
 * Le courriel de la cible reste réservé (contrainte `unique()` sur
 * `user.email`, voir src/db/schema.ts) : voir le commentaire de
 * `createUserWithPassword` (src/lib/auth/create-user.ts) pour ce compromis
 * assumé.
 */
export async function deleteUser(actingUserId: string, id: string): Promise<void> {
  if (id === actingUserId) {
    throw new Error("Vous ne pouvez pas supprimer votre propre compte.");
  }

  await db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: user.id, name: user.name, email: user.email, role: user.role })
      .from(user)
      .where(and(eq(user.id, id), isNull(user.deletedAt)))
      .limit(1);
    if (!target) {
      throw new Error("Cet utilisateur est introuvable.");
    }

    if (target.role === ADMIN_ROLE_ID) {
      const adminCount = await lockAndCountAdmins(tx);
      if (adminCount <= 1) {
        throw new Error(
          "Impossible de supprimer ce compte : c'est le dernier administrateur de l'application.",
        );
      }
    }

    await tx.update(user).set({ deletedAt: new Date() }).where(eq(user.id, id));
    await tx.delete(session).where(eq(session.userId, id));

    const actorLabel = await resolveActorLabel(tx, actingUserId);
    await recordAudit(tx, {
      actorId: actingUserId,
      actorLabel,
      action: "user.delete",
      targetType: "user",
      targetId: id,
      targetLabel: `${target.name} (${target.email})`,
    });
  });
}
