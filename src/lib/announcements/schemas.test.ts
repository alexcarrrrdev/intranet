import { describe, expect, it } from "vitest"

import { createAnnouncementSchema, setPinnedSchema } from "@/lib/announcements/schemas"

describe("createAnnouncementSchema", () => {
  it("accepte une annonce valide", () => {
    const result = createAnnouncementSchema.safeParse({ title: "Fermeture", body: "Le bureau sera fermé." })
    expect(result.success).toBe(true)
  })

  it("refuse un titre vide", () => {
    const result = createAnnouncementSchema.safeParse({ title: "  ", body: "Contenu" })
    expect(result.success).toBe(false)
  })

  it("refuse un contenu vide", () => {
    const result = createAnnouncementSchema.safeParse({ title: "Titre", body: "" })
    expect(result.success).toBe(false)
  })
})

describe("setPinnedSchema", () => {
  it("accepte un booléen d'épinglage", () => {
    const result = setPinnedSchema.safeParse({ announcementId: "a1", pinned: true })
    expect(result.success).toBe(true)
  })
})
