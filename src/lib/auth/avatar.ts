/**
 * Photo de profil personnalisée d'un utilisateur (/profil). Même patron que
 * src/lib/settings/app-settings.ts pour le logo de l'application (colonne
 * `bytea` + type MIME, cache-busting par horodatage), mais rattaché à
 * chaque utilisateur plutôt qu'à une unique rangée de réglages globaux — un
 * utilisateur ne peut modifier que SA PROPRE photo (voir requireOwnSession
 * dans src/app/actions/profile.ts).
 *
 * `user.image` (colonne Better Auth existante, voir src/db/schema.ts) est
 * maintenu en cohérence par `setAvatar`/`clearAvatar` ci-dessous : il pointe
 * vers `/avatar/<userId>?v=<horodatage>` tant qu'une photo est configurée,
 * ou `null` sinon — c'est ce champ, déjà affiché partout dans l'application
 * (annuaire, fil, composeur, etc. — voir user.image dans ces composants),
 * qui fait qu'aucun de ces endroits n'a besoin d'être modifié pour profiter
 * de cette fonctionnalité.
 */
import { cache } from "react"
import { eq } from "drizzle-orm"

import { db } from "@/db"
import { user } from "@/db/schema"
import { recordAudit, resolveActorLabel } from "@/lib/audit/audit"

export type AvatarData = {
  data: Buffer
  mimeType: string
}

/**
 * Lit les octets de la photo de profil d'un utilisateur et son type MIME.
 * Utilisé uniquement par la route de service (src/app/avatar/[userId]/
 * route.ts) — mémorisé avec `cache()` au cas où elle serait appelée
 * plusieurs fois dans le traitement d'une même requête, comme `getLogo`
 * dans src/lib/settings/app-settings.ts.
 */
export const getAvatar = cache(async function getAvatar(
  userId: string,
): Promise<AvatarData | null> {
  const [row] = await db
    .select({ avatar: user.avatar, avatarMimeType: user.avatarMimeType })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  if (!row?.avatar || !row.avatarMimeType) return null

  return { data: row.avatar, mimeType: row.avatarMimeType }
})

/**
 * Construit l'URL de photo de profil à écrire dans `user.image`, versionnée
 * par horodatage pour le cache-busting (voir le commentaire de `logoVersion`
 * dans src/lib/settings/app-settings.ts pour le même principe appliqué au
 * logo) : `Cache-Control` sur /avatar/[userId] est agressif (voir cette
 * route), donc l'URL doit changer dès que la photo change pour que le
 * navigateur affiche la nouvelle image immédiatement.
 */
function buildAvatarImageUrl(userId: string): string {
  return `/avatar/${userId}?v=${Date.now()}`
}

/**
 * Enregistre la photo de profil (octets + type MIME, déjà validés par
 * l'appelant — voir src/lib/settings/avatar-validation.ts et
 * src/app/actions/profile.ts) et met à jour `user.image` en conséquence.
 *
 * `actorId` est toujours égal à `userId` en pratique (un utilisateur ne
 * modifie que sa propre photo), mais les deux sont conservés distincts par
 * cohérence avec `setLogo` (src/lib/settings/app-settings.ts), qui journalise
 * de la même façon un `actorId` séparé de la cible.
 */
export async function setAvatar(
  actorId: string,
  userId: string,
  data: Buffer,
  mimeType: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(user)
      .set({
        avatar: data,
        avatarMimeType: mimeType,
        image: buildAvatarImageUrl(userId),
      })
      .where(eq(user.id, userId))

    const actorLabel = await resolveActorLabel(tx, actorId)
    await recordAudit(tx, {
      actorId,
      actorLabel,
      action: "profile.avatar.update",
      targetType: "user",
      targetId: userId,
      targetLabel: actorLabel,
      details: { mimeType, size: data.byteLength },
    })
  })
}

/**
 * Retire la photo de profil : `user.image` retombe à `null`, l'application
 * affiche alors les initiales (voir getInitials dans
 * src/components/nav-user.tsx) partout où l'avatar est utilisé.
 */
export async function clearAvatar(actorId: string, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(user)
      .set({ avatar: null, avatarMimeType: null, image: null })
      .where(eq(user.id, userId))

    const actorLabel = await resolveActorLabel(tx, actorId)
    await recordAudit(tx, {
      actorId,
      actorLabel,
      action: "profile.avatar.delete",
      targetType: "user",
      targetId: userId,
      targetLabel: actorLabel,
    })
  })
}
