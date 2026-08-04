import { describe, expect, it } from "vitest"

import { createRoleSchema, updateRoleSchema } from "@/lib/auth/role-schemas"

describe("createRoleSchema", () => {
  it("accepte un nom seul, sans identifiant ni description", () => {
    const result = createRoleSchema.safeParse({ name: "Support Client", permissions: [] })
    expect(result.success).toBe(true)
  })

  it("accepte un identifiant explicite valide", () => {
    const result = createRoleSchema.safeParse({
      id: "support-client",
      name: "Support Client",
      permissions: ["user:read"],
    })
    expect(result.success).toBe(true)
  })

  it("traite un identifiant vide comme absent", () => {
    const result = createRoleSchema.safeParse({ id: "", name: "Support Client", permissions: [] })
    expect(result.success).toBe(true)
  })

  it("rejette un identifiant qui ne respecte pas le format attendu", () => {
    const result = createRoleSchema.safeParse({
      id: "Support Client!",
      name: "Support Client",
      permissions: [],
    })
    expect(result.success).toBe(false)
  })

  it("rejette un nom vide", () => {
    const result = createRoleSchema.safeParse({ name: "", permissions: [] })
    expect(result.success).toBe(false)
  })

  it("rejette un nom composé uniquement d'espaces", () => {
    const result = createRoleSchema.safeParse({ name: "   ", permissions: [] })
    expect(result.success).toBe(false)
  })

  it("applique un tableau de permissions vide par défaut", () => {
    const result = createRoleSchema.safeParse({ name: "Support Client" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.permissions).toEqual([])
    }
  })

  it("rejette une description trop longue", () => {
    const result = createRoleSchema.safeParse({
      name: "Support Client",
      description: "a".repeat(501),
      permissions: [],
    })
    expect(result.success).toBe(false)
  })
})

describe("updateRoleSchema", () => {
  it("accepte un nom et des permissions", () => {
    const result = updateRoleSchema.safeParse({
      name: "Nouveau nom",
      permissions: ["user:read", "settings:read"],
    })
    expect(result.success).toBe(true)
  })

  it("rejette un nom vide", () => {
    const result = updateRoleSchema.safeParse({ name: "", permissions: [] })
    expect(result.success).toBe(false)
  })
})
