import { describe, expect, it } from "vitest"

import {
  DEFAULT_APP_NAME,
  resolveAppName,
  resolveHasLogo,
  resolvePrimaryColor,
} from "@/lib/settings/app-settings"

// Ces tests couvrent la logique pure (repli par défaut), sans toucher à la
// base de données — voir src/lib/settings/app-settings.integration.test.ts
// pour la persistance réelle (lecture/écriture en Postgres) ET pour
// canManageAppSettings, qui résout désormais les permissions depuis la base
// (voir src/lib/auth/permissions.ts) et ne peut donc plus être testée sans
// elle.

describe("resolveAppName", () => {
  it("retombe sur le nom par défaut quand aucune rangée n'existe", () => {
    expect(resolveAppName(undefined)).toBe(DEFAULT_APP_NAME)
    expect(resolveAppName(null)).toBe(DEFAULT_APP_NAME)
  })

  it("retourne le nom enregistré quand une rangée existe", () => {
    expect(resolveAppName({ appName: "Acme Corp" })).toBe("Acme Corp")
  })
})

describe("resolveHasLogo", () => {
  it("retourne faux quand aucune rangée n'existe", () => {
    expect(resolveHasLogo(undefined)).toBe(false)
    expect(resolveHasLogo(null)).toBe(false)
  })

  it("retourne faux quand la rangée existe mais n'a pas de logo", () => {
    expect(resolveHasLogo({ logoMimeType: null })).toBe(false)
  })

  it("retourne vrai quand un type MIME de logo est enregistré", () => {
    expect(resolveHasLogo({ logoMimeType: "image/png" })).toBe(true)
  })
})

describe("resolvePrimaryColor", () => {
  it("retourne null quand aucune rangée n'existe", () => {
    expect(resolvePrimaryColor(undefined)).toBeNull()
    expect(resolvePrimaryColor(null)).toBeNull()
  })

  it("retourne null quand la rangée existe mais n'a pas de couleur personnalisée", () => {
    expect(resolvePrimaryColor({ primaryColor: null })).toBeNull()
  })

  it("retourne la couleur enregistrée quand elle existe", () => {
    expect(resolvePrimaryColor({ primaryColor: "#2563eb" })).toBe("#2563eb")
  })
})

