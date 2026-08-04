// Validation du fichier logo téléversé depuis /administration/general (voir
// src/app/actions/app-settings.ts). Fonctions PURES (aucun accès au système
// de fichiers ni à la base de données) afin de pouvoir les tester
// unitairement sans dépendance — voir logo-validation.test.ts.
//
// Défense en profondeur : cette validation contrôle la taille, le type MIME
// déclaré ET la signature réelle du contenu (« magic bytes » pour les formats
// matriciels, liste noire de motifs dangereux pour SVG). Elle s'ajoute aux
// en-têtes de sécurité posés par la route /logo (src/app/logo/route.ts), qui
// empêchent l'exécution de tout script même si un fichier malveillant
// parvenait malgré tout à être stocké.

// 1 Mo — taille maximale d'un logo, gardée volontairement petite : le logo
// n'est affiché qu'en petit format (barre latérale, en-tête des pages
// publiques), rien ne justifie un fichier plus lourd.
export const MAX_LOGO_SIZE_BYTES = 1_048_576

export const ALLOWED_LOGO_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
] as const

export type AllowedLogoMimeType = (typeof ALLOWED_LOGO_MIME_TYPES)[number]

export type LogoValidationResult =
  | { valid: true }
  | { valid: false; error: string }

function isAllowedMimeType(mimeType: string): mimeType is AllowedLogoMimeType {
  return (ALLOWED_LOGO_MIME_TYPES as readonly string[]).includes(mimeType)
}

function hasSignature(
  bytes: Uint8Array,
  signature: readonly number[],
  offset = 0,
): boolean {
  if (bytes.byteLength < offset + signature.length) return false
  return signature.every((byte, index) => bytes[offset + index] === byte)
}

// Signatures ("magic bytes") des formats matriciels acceptés — voir
// https://en.wikipedia.org/wiki/List_of_file_signatures. Un fichier dont le
// type MIME déclaré ne correspond pas à sa signature réelle est refusé :
// cela empêche par exemple de faire passer un exécutable ou un HTML pour un
// PNG en se contentant de mentir sur le Content-Type.
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

// SVG est un format texte (XML) : pas de « magic bytes » à vérifier, mais un
// contenu potentiellement actif (scripts, gestionnaires d'événements). Cette
// liste noire est volontairement CONSERVATRICE et documentée comme telle :
// ce n'est PAS un sanitizer (elle ne modifie rien, ne couvre pas tous les
// vecteurs XSS possibles en SVG) mais une mesure de défense en profondeur en
// complément de l'en-tête `Content-Security-Policy: sandbox` posé par la
// route /logo, qui empêche de toute façon l'exécution de script si un fichier
// malveillant passait au travers.
const SVG_DANGEROUS_PATTERNS = [
  /<script/i,
  /onload\s*=/i,
  /onerror\s*=/i,
  /javascript:/i,
  /<foreignObject/i,
]

function isSvgRoot(text: string): boolean {
  return /<svg[\s>]/i.test(text)
}

function containsDangerousSvgContent(text: string): boolean {
  return SVG_DANGEROUS_PATTERNS.some((pattern) => pattern.test(text))
}

/**
 * Valide un fichier logo côté serveur : taille, type MIME déclaré, puis
 * cohérence du contenu réel avec ce type déclaré (signature binaire pour les
 * formats matriciels, liste noire pour SVG). Retourne un message d'erreur en
 * français prêt à afficher tel quel dans l'Alert du formulaire.
 */
export function validateLogoFile(
  bytes: Uint8Array,
  mimeType: string,
): LogoValidationResult {
  if (bytes.byteLength === 0) {
    return { valid: false, error: "Le fichier est vide." }
  }

  if (bytes.byteLength > MAX_LOGO_SIZE_BYTES) {
    return {
      valid: false,
      error: "Le fichier est trop volumineux (1 Mo maximum).",
    }
  }

  if (!isAllowedMimeType(mimeType)) {
    return {
      valid: false,
      error:
        "Format de fichier non pris en charge (PNG, JPEG, WebP ou SVG uniquement).",
    }
  }

  if (mimeType === "image/svg+xml") {
    const text = Buffer.from(bytes).toString("utf-8")
    if (!isSvgRoot(text)) {
      return {
        valid: false,
        error: "Ce fichier ne contient pas de balise <svg> valide.",
      }
    }
    if (containsDangerousSvgContent(text)) {
      return {
        valid: false,
        error:
          "Ce fichier SVG contient du contenu potentiellement dangereux (script ou gestionnaire d'événement) et a été refusé.",
      }
    }
    return { valid: true }
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
