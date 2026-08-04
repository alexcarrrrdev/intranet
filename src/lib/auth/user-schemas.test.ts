import { describe, expect, it } from "vitest"

import { createUserSchema, updateUserSchema } from "@/lib/auth/user-schemas"

describe("createUserSchema", () => {
  const base = {
    name: "Alex Caron",
    email: "alex@exemple.com",
    password: "motdepasse123",
    role: "member",
  }

  it("accepte un utilisateur valide", () => {
    expect(createUserSchema.safeParse(base).success).toBe(true)
  })

  it("rejette un nom vide", () => {
    expect(createUserSchema.safeParse({ ...base, name: "" }).success).toBe(false)
  })

  it("rejette un courriel invalide", () => {
    expect(
      createUserSchema.safeParse({ ...base, email: "pas-un-courriel" }).success,
    ).toBe(false)
  })

  it("rejette un mot de passe de moins de 8 caractères", () => {
    expect(createUserSchema.safeParse({ ...base, password: "court1" }).success).toBe(
      false,
    )
  })

  it("rejette un rôle vide", () => {
    expect(createUserSchema.safeParse({ ...base, role: "" }).success).toBe(false)
  })
})

describe("updateUserSchema", () => {
  it("accepte un objet vide (aucun changement)", () => {
    expect(updateUserSchema.safeParse({}).success).toBe(true)
  })

  it("accepte uniquement un nom", () => {
    expect(updateUserSchema.safeParse({ name: "Nouveau nom" }).success).toBe(true)
  })

  it("accepte uniquement un rôle", () => {
    expect(updateUserSchema.safeParse({ role: "admin" }).success).toBe(true)
  })

  it("rejette un nom vide quand il est fourni", () => {
    expect(updateUserSchema.safeParse({ name: "" }).success).toBe(false)
  })
})
