import { describe, expect, it } from "vitest"

import {
  MAX_LOGO_SIZE_BYTES,
  validateLogoFile,
} from "@/lib/settings/logo-validation"

// Ces tests couvrent la validation pure du fichier logo (taille, type MIME,
// signature binaire, liste noire SVG), sans base de données ni Server
// Action — voir src/lib/settings/app-settings.integration.test.ts pour la
// persistance réelle.

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

describe("validateLogoFile — taille", () => {
  it("refuse un fichier vide", () => {
    const result = validateLogoFile(new Uint8Array(), "image/png")

    expect(result).toEqual({ valid: false, error: "Le fichier est vide." })
  })

  it("refuse un fichier trop volumineux", () => {
    const oversized = new Uint8Array(MAX_LOGO_SIZE_BYTES + 1)
    oversized.set(PNG_BYTES)

    const result = validateLogoFile(oversized, "image/png")

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toBe("Le fichier est trop volumineux (1 Mo maximum).")
    }
  })

  it("accepte un fichier à exactement la taille maximale", () => {
    const atLimit = new Uint8Array(MAX_LOGO_SIZE_BYTES)
    atLimit.set(PNG_BYTES)

    const result = validateLogoFile(atLimit, "image/png")

    expect(result.valid).toBe(true)
  })
})

describe("validateLogoFile — type MIME", () => {
  it("refuse un type MIME hors liste blanche", () => {
    const result = validateLogoFile(PNG_BYTES, "application/pdf")

    expect(result).toEqual({
      valid: false,
      error:
        "Format de fichier non pris en charge (PNG, JPEG, WebP ou SVG uniquement).",
    })
  })
})

describe("validateLogoFile — signature binaire", () => {
  it("accepte un PNG valide", () => {
    expect(validateLogoFile(PNG_BYTES, "image/png")).toEqual({ valid: true })
  })

  it("refuse des octets qui ne correspondent pas à la signature PNG", () => {
    const fake = textBytes("<html><body>pas une image</body></html>")

    const result = validateLogoFile(fake, "image/png")

    expect(result).toEqual({
      valid: false,
      error: "Le contenu du fichier ne correspond pas à une image PNG valide.",
    })
  })

  it("accepte un JPEG valide", () => {
    expect(validateLogoFile(JPEG_BYTES, "image/jpeg")).toEqual({ valid: true })
  })

  it("refuse des octets qui ne correspondent pas à la signature JPEG", () => {
    const result = validateLogoFile(PNG_BYTES, "image/jpeg")

    expect(result).toEqual({
      valid: false,
      error: "Le contenu du fichier ne correspond pas à une image JPEG valide.",
    })
  })

  it("accepte un WebP valide", () => {
    expect(validateLogoFile(WEBP_BYTES, "image/webp")).toEqual({ valid: true })
  })

  it("refuse des octets qui ne correspondent pas à la signature WebP", () => {
    const result = validateLogoFile(PNG_BYTES, "image/webp")

    expect(result).toEqual({
      valid: false,
      error: "Le contenu du fichier ne correspond pas à une image WebP valide.",
    })
  })
})

describe("validateLogoFile — SVG", () => {
  it("accepte un SVG propre", () => {
    const svg = textBytes(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg>',
    )

    expect(validateLogoFile(svg, "image/svg+xml")).toEqual({ valid: true })
  })

  it("refuse un SVG sans balise <svg>", () => {
    const notSvg = textBytes("<div>pas un SVG</div>")

    const result = validateLogoFile(notSvg, "image/svg+xml")

    expect(result).toEqual({
      valid: false,
      error: "Ce fichier ne contient pas de balise <svg> valide.",
    })
  })

  it("refuse un SVG contenant <script>", () => {
    const malicious = textBytes(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    )

    const result = validateLogoFile(malicious, "image/svg+xml")

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain("dangereux")
    }
  })

  it("refuse un SVG contenant un gestionnaire onload", () => {
    const malicious = textBytes(
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>',
    )

    expect(validateLogoFile(malicious, "image/svg+xml").valid).toBe(false)
  })

  it("refuse un SVG contenant un gestionnaire onerror", () => {
    const malicious = textBytes(
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="x" onerror="alert(1)" /></svg>',
    )

    expect(validateLogoFile(malicious, "image/svg+xml").valid).toBe(false)
  })

  it("refuse un SVG contenant un lien javascript:", () => {
    const malicious = textBytes(
      '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><circle r="1" /></a></svg>',
    )

    expect(validateLogoFile(malicious, "image/svg+xml").valid).toBe(false)
  })

  it("refuse un SVG contenant <foreignObject>", () => {
    const malicious = textBytes(
      '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body xmlns="http://www.w3.org/1999/xhtml">x</body></foreignObject></svg>',
    )

    expect(validateLogoFile(malicious, "image/svg+xml").valid).toBe(false)
  })
})
