import { describe, expect, it } from "vitest"

import { createGroupSchema } from "@/lib/groups/schemas"

describe("createGroupSchema", () => {
  it("accepte un groupe valide", () => {
    const result = createGroupSchema.safeParse({ name: "Comité social", description: "Organise les événements" })
    expect(result.success).toBe(true)
  })

  it("accepte un groupe sans description", () => {
    const result = createGroupSchema.safeParse({ name: "Comité social" })
    expect(result.success).toBe(true)
  })

  it("refuse un nom vide", () => {
    const result = createGroupSchema.safeParse({ name: "   " })
    expect(result.success).toBe(false)
  })

  it("refuse un nom trop long", () => {
    const result = createGroupSchema.safeParse({ name: "a".repeat(101) })
    expect(result.success).toBe(false)
  })

  it("refuse une description trop longue", () => {
    const result = createGroupSchema.safeParse({ name: "Comité social", description: "a".repeat(2001) })
    expect(result.success).toBe(false)
  })
})
