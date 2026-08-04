import { describe, expect, it } from "vitest"

import { decideRateLimit, deriveClientKey } from "@/lib/auth/rate-limit"

// Ces tests couvrent uniquement la logique pure de src/lib/auth/rate-limit.ts
// (décision, dérivation de la clé client), indépendamment de NODE_ENV et
// sans toucher à la base de données — voir
// src/lib/auth/rate-limit.integration.test.ts pour le comportement de stockage
// contre la vraie table rate_limit.

describe("decideRateLimit", () => {
  it("n'est pas limité tant que le compteur ne dépasse pas la limite", () => {
    expect(decideRateLimit(1, 10)).toEqual({ limited: false })
    expect(decideRateLimit(10, 10)).toEqual({ limited: false })
  })

  it("est limité dès que le compteur dépasse la limite", () => {
    expect(decideRateLimit(11, 10)).toEqual({ limited: true })
    expect(decideRateLimit(100, 10)).toEqual({ limited: true })
  })
})

describe("deriveClientKey", () => {
  it("utilise la première adresse de x-forwarded-for", () => {
    const headerList = new Headers({
      "x-forwarded-for": "203.0.113.5, 70.41.3.18, 150.172.238.178",
    })
    expect(deriveClientKey(headerList)).toBe("203.0.113.5")
  })

  it("retombe sur x-real-ip si x-forwarded-for est absent", () => {
    const headerList = new Headers({ "x-real-ip": "198.51.100.23" })
    expect(deriveClientKey(headerList)).toBe("198.51.100.23")
  })

  it("préfère x-forwarded-for à x-real-ip quand les deux sont présents", () => {
    const headerList = new Headers({
      "x-forwarded-for": "203.0.113.5",
      "x-real-ip": "198.51.100.23",
    })
    expect(deriveClientKey(headerList)).toBe("203.0.113.5")
  })

  it("retombe sur « unknown » quand aucun en-tête n'est présent", () => {
    expect(deriveClientKey(new Headers())).toBe("unknown")
  })

  it("retombe sur « unknown » quand x-forwarded-for est une chaîne vide", () => {
    const headerList = new Headers({ "x-forwarded-for": "" })
    expect(deriveClientKey(headerList)).toBe("unknown")
  })
})
