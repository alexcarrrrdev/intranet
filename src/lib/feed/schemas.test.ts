import { describe, expect, it } from "vitest"

import {
  addCommentSchema,
  createKudosPostSchema,
  createMessagePostSchema,
  createPollPostSchema,
  setReactionSchema,
} from "@/lib/feed/schemas"

describe("createMessagePostSchema", () => {
  it("accepte un message valide", () => {
    const result = createMessagePostSchema.safeParse({ groupId: null, body: "Bonjour tout le monde" })
    expect(result.success).toBe(true)
  })

  it("refuse un message vide", () => {
    const result = createMessagePostSchema.safeParse({ groupId: null, body: "   " })
    expect(result.success).toBe(false)
  })

  it("refuse un message trop long", () => {
    const result = createMessagePostSchema.safeParse({ groupId: null, body: "a".repeat(2001) })
    expect(result.success).toBe(false)
  })
})

describe("createKudosPostSchema", () => {
  it("exige un destinataire", () => {
    const result = createKudosPostSchema.safeParse({ groupId: null, body: "Bravo !", kudosRecipientId: "" })
    expect(result.success).toBe(false)
  })

  it("accepte un bon coup valide", () => {
    const result = createKudosPostSchema.safeParse({
      groupId: null,
      body: "Bravo !",
      kudosRecipientId: "user-1",
    })
    expect(result.success).toBe(true)
  })
})

describe("createPollPostSchema", () => {
  it("refuse un sondage avec une seule option", () => {
    const result = createPollPostSchema.safeParse({ groupId: null, body: "Question ?", options: ["A"] })
    expect(result.success).toBe(false)
  })

  it("refuse un sondage avec plus de 5 options", () => {
    const result = createPollPostSchema.safeParse({
      groupId: null,
      body: "Question ?",
      options: ["A", "B", "C", "D", "E", "F"],
    })
    expect(result.success).toBe(false)
  })

  it("accepte un sondage avec 2 à 5 options", () => {
    const result = createPollPostSchema.safeParse({
      groupId: null,
      body: "Question ?",
      options: ["A", "B", "C"],
    })
    expect(result.success).toBe(true)
  })
})

describe("setReactionSchema", () => {
  it("accepte un emoji de l'ensemble fermé", () => {
    const result = setReactionSchema.safeParse({ postId: "p1", emoji: "👍" })
    expect(result.success).toBe(true)
  })

  it("refuse un emoji hors de l'ensemble fermé", () => {
    const result = setReactionSchema.safeParse({ postId: "p1", emoji: "🔥" })
    expect(result.success).toBe(false)
  })
})

describe("addCommentSchema", () => {
  it("refuse un commentaire trop long", () => {
    const result = addCommentSchema.safeParse({ postId: "p1", body: "a".repeat(1001) })
    expect(result.success).toBe(false)
  })
})

describe("exclusivité du contexte (groupe XOR événement)", () => {
  it("accepte un post rattaché à un événement seul", () => {
    const result = createMessagePostSchema.safeParse({
      groupId: null,
      eventId: "evt-1",
      body: "Bonjour",
    })
    expect(result.success).toBe(true)
  })

  it("refuse un post rattaché à un groupe ET un événement en même temps", () => {
    const result = createMessagePostSchema.safeParse({
      groupId: "group-1",
      eventId: "evt-1",
      body: "Bonjour",
    })
    expect(result.success).toBe(false)
  })
})
