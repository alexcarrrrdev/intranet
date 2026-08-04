import { describe, expect, it } from "vitest"

import { updateAppNameSchema, updatePrimaryColorSchema } from "@/lib/settings/schemas"

describe("updateAppNameSchema", () => {
  it("accepte un nom d'application non vide", () => {
    expect(
      updateAppNameSchema.safeParse({ appName: "Mon application" }).success,
    ).toBe(true)
  })

  it("retire les espaces superflus avant validation", () => {
    const result = updateAppNameSchema.safeParse({ appName: "  Acme  " })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.appName).toBe("Acme")
    }
  })

  it("rejette un nom vide", () => {
    expect(updateAppNameSchema.safeParse({ appName: "" }).success).toBe(false)
  })

  it("rejette un nom composé uniquement d'espaces", () => {
    expect(updateAppNameSchema.safeParse({ appName: "   " }).success).toBe(
      false,
    )
  })

  it("rejette un nom de plus de 100 caractères", () => {
    const result = updateAppNameSchema.safeParse({
      appName: "a".repeat(101),
    })
    expect(result.success).toBe(false)
  })

  it("accepte un nom de exactement 100 caractères", () => {
    const result = updateAppNameSchema.safeParse({
      appName: "a".repeat(100),
    })
    expect(result.success).toBe(true)
  })
})

describe("updatePrimaryColorSchema", () => {
  it("accepte un #RRGGBB valide", () => {
    expect(
      updatePrimaryColorSchema.safeParse({ primaryColor: "#2563eb" }).success,
    ).toBe(true)
  })

  it("accepte un #RRGGBB en majuscules", () => {
    expect(
      updatePrimaryColorSchema.safeParse({ primaryColor: "#2563EB" }).success,
    ).toBe(true)
  })

  it("rejette une forme courte (#RGB)", () => {
    expect(
      updatePrimaryColorSchema.safeParse({ primaryColor: "#fff" }).success,
    ).toBe(false)
  })

  it("rejette une chaîne sans dièse", () => {
    expect(
      updatePrimaryColorSchema.safeParse({ primaryColor: "2563eb" }).success,
    ).toBe(false)
  })

  it("rejette une chaîne vide", () => {
    expect(
      updatePrimaryColorSchema.safeParse({ primaryColor: "" }).success,
    ).toBe(false)
  })
})
