// Validation du fichier de photo de profil téléversé depuis /profil (voir
// src/app/actions/profile.ts). Fonctions PURES (aucun accès au système de
// fichiers ni à la base de données) afin de pouvoir les tester unitairement
// sans dépendance — même patron que src/lib/settings/logo-validation.ts,
// voir avatar-validation.test.ts.
//
// Défense en profondeur : cette validation contrôle la taille, le type MIME
// déclaré ET la signature réelle du contenu (« magic bytes »). Contrairement
// au logo, SVG n'est PAS accepté ici : une photo de profil n'a aucune raison
// d'être un format vectoriel/actif, ce qui évite d'avoir à reprendre la
// liste noire de contenu SVG dangereux pour un cas d'usage qui n'en a pas
// besoin.

// 10 Mo — taille maximale d'une photo de profil. Plus permissif que le logo
// (1 Mo, voir MAX_LOGO_SIZE_BYTES dans logo-validation.ts) : une photo de
// profil est fournie par chaque utilisateur depuis son propre appareil
// (souvent une photo prise telle quelle par un téléphone), alors que le logo
// est un actif de marque préparé par un administrateur.
export const MAX_AVATAR_SIZE_BYTES = 10 * 1_048_576

export const ALLOWED_AVATAR_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const

export type AllowedAvatarMimeType = (typeof ALLOWED_AVATAR_MIME_TYPES)[number]

export type AvatarValidationResult =
  | { valid: true }
  | { valid: false; error: string }

function isAllowedMimeType(
  mimeType: string,
): mimeType is AllowedAvatarMimeType {
  return (ALLOWED_AVATAR_MIME_TYPES as readonly string[]).includes(mimeType)
}

function hasSignature(
  bytes: Uint8Array,
  signature: readonly number[],
  offset = 0,
): boolean {
  if (bytes.byteLength < offset + signature.length) return false
  return signature.every((byte, index) => bytes[offset + index] === byte)
}

// Signatures ("magic bytes") des formats acceptés — voir le commentaire
// équivalent dans src/lib/settings/logo-validation.ts.
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff]
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46] // "RIFF"
const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50] // "WEBP", à l'octet 8 d'un conteneur RIFF

function isPng(bytes: Uint8Array): boolean {
  return hasSignature(bytes, PNG_SIGNATURE)
}

function isJpeg(bytes: Uint8Array): boolean {
  return hasSignature(bytes, JPEG_SIGNATURE)
}

function isWebp(bytes: Uint8Array): boolean {
  return hasSignature(bytes, RIFF_SIGNATURE) && hasSignature(bytes, WEBP_SIGNATURE, 8)
}

/**
 * Valide un fichier de photo de profil côté serveur : taille, type MIME
 * déclaré, puis cohérence du contenu réel avec ce type déclaré (signature
 * binaire). Retourne un message d'erreur en français prêt à afficher tel
 * quel dans l'Alert du formulaire.
 */
export function validateAvatarFile(
  bytes: Uint8Array,
  mimeType: string,
): AvatarValidationResult {
  if (bytes.byteLength === 0) {
    return { valid: false, error: "Le fichier est vide." }
  }

  if (bytes.byteLength > MAX_AVATAR_SIZE_BYTES) {
    return {
      valid: false,
      error: "Le fichier est trop volumineux (10 Mo maximum).",
    }
  }

  if (!isAllowedMimeType(mimeType)) {
    return {
      valid: false,
      error: "Format de fichier non pris en charge (PNG, JPEG ou WebP uniquement).",
    }
  }

  if (mimeType === "image/png" && !isPng(bytes)) {
    return {
      valid: false,
      error: "Le contenu du fichier ne correspond pas à une image PNG valide.",
    }
  }

  if (mimeType === "image/jpeg" && !isJpeg(bytes)) {
    return {
      valid: false,
      error: "Le contenu du fichier ne correspond pas à une image JPEG valide.",
    }
  }

  if (mimeType === "image/webp" && !isWebp(bytes)) {
    return {
      valid: false,
      error: "Le contenu du fichier ne correspond pas à une image WebP valide.",
    }
  }

  return { valid: true }
}
