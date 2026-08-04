import { describe, expect, it } from "vitest"

import { createEventSchema } from "@/lib/events/schemas"

describe("createEventSchema", () => {
  it("accepte un événement minimal valide", () => {
    const result = createEventSchema.safeParse({
      title: "Fête de Noël",
      startsAt: "2026-12-15T18:00",
      allDay: false,
    })
    expect(result.success).toBe(true)
  })

  it("refuse un titre vide", () => {
    const result = createEventSchema.safeParse({
      title: "   ",
      startsAt: "2026-12-15T18:00",
      allDay: false,
    })
    expect(result.success).toBe(false)
  })

  it("refuse une date de début invalide", () => {
    const result = createEventSchema.safeParse({
      title: "Fête de Noël",
      startsAt: "pas une date",
      allDay: false,
    })
    expect(result.success).toBe(false)
  })

  it("refuse une date de fin avant la date de début", () => {
    const result = createEventSchema.safeParse({
      title: "Fête de Noël",
      startsAt: "2026-12-15T18:00",
      endsAt: "2026-12-15T10:00",
      allDay: false,
    })
    expect(result.success).toBe(false)
  })

  it("accepte une date de fin après la date de début", () => {
    const result = createEventSchema.safeParse({
      title: "Fête de Noël",
      startsAt: "2026-12-15T18:00",
      endsAt: "2026-12-15T22:00",
      allDay: false,
    })
    expect(result.success).toBe(true)
  })

  it("transforme une description vide en undefined", () => {
    const result = createEventSchema.safeParse({
      title: "Fête de Noël",
      description: "   ",
      startsAt: "2026-12-15T18:00",
      allDay: false,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.description).toBeUndefined()
    }
  })
})
