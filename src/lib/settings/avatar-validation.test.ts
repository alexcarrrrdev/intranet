import { describe, expect, it } from "vitest"

import {
  MAX_AVATAR_SIZE_BYTES,
  validateAvatarFile,
} from "@/lib/settings/avatar-validation"

// Ces tests couvrent la validation pure du fichier de photo de profil
// (taille, type MIME, signature binaire), même patron que
// src/lib/settings/logo-validation.test.ts.

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
])

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])

const WEBP_BYTES = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
])

function textBytes(text: string): Uint8Array {
  return new Uint8Array(Buffer.from(text, "utf-8"))
}

describe("validateAvatarFile — taille", () => {
  it("refuse un fichier vide", () => {
    const result = validateAvatarFile(new Uint8Array(), "image/png")

    expect(result).toEqual({ valid: false, error: "Le fichier est vide." })
  })

  it("refuse un fichier trop volumineux", () => {
    const oversized = new Uint8Array(MAX_AVATAR_SIZE_BYTES + 1)
    oversized.set(PNG_BYTES)

    const result = validateAvatarFile(oversized, "image/png")

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toBe("Le fichier est trop volumineux (10 Mo maximum).")
    }
  })

  it("accepte un fichier à exactement la taille maximale", () => {
    const atLimit = new Uint8Array(MAX_AVATAR_SIZE_BYTES)
    atLimit.set(PNG_BYTES)

    const result = validateAvatarFile(atLimit, "image/png")

    expect(result.valid).toBe(true)
  })
})

describe("validateAvatarFile — type MIME", () => {
  it("refuse un type MIME hors liste blanche", () => {
    const result = validateAvatarFile(PNG_BYTES, "application/pdf")

    expect(result).toEqual({
      valid: false,
      error: "Format de fichier non pris en charge (PNG, JPEG ou WebP uniquement).",
    })
  })

  it("refuse le SVG (non pris en charge pour les photos de profil)", () => {
    const svg = textBytes(
      '<svg xmlns="http://www.w3.org/2000/svg"><circle r="1" /></svg>',
    )

    const result = validateAvatarFile(svg, "image/svg+xml")

    expect(result.valid).toBe(false)
  })
})

describe("validateAvatarFile — signature binaire", () => {
  it("accepte un PNG valide", () => {
    expect(validateAvatarFile(PNG_BYTES, "image/png")).toEqual({ valid: true })
  })

  it("refuse des octets qui ne correspondent pas à la signature PNG", () => {
    const fake = textBytes("<html><body>pas une image</body></html>")

    const result = validateAvatarFile(fake, "image/png")

    expect(result).toEqual({
      valid: false,
      error: "Le contenu du fichier ne correspond pas à une image PNG valide.",
    })
  })

  it("accepte un JPEG valide", () => {
    expect(validateAvatarFile(JPEG_BYTES, "image/jpeg")).toEqual({ valid: true })
  })

  it("refuse des octets qui ne correspondent pas à la signature JPEG", () => {
    const result = validateAvatarFile(PNG_BYTES, "image/jpeg")

    expect(result).toEqual({
      valid: false,
      error: "Le contenu du fichier ne correspond pas à une image JPEG valide.",
    })
  })

  it("accepte un WebP valide", () => {
    expect(validateAvatarFile(WEBP_BYTES, "image/webp")).toEqual({ valid: true })
  })

  it("refuse des octets qui ne correspondent pas à la signature WebP", () => {
    const result = validateAvatarFile(PNG_BYTES, "image/webp")

    expect(result).toEqual({
      valid: false,
      error: "Le contenu du fichier ne correspond pas à une image WebP valide.",
    })
  })
})
