import { describe, expect, it } from "vitest"

import { computePollPercentages } from "@/lib/feed/posts"

describe("computePollPercentages", () => {
  it("retourne 0 % pour chaque option quand il n'y a aucun vote", () => {
    const result = computePollPercentages([
      { id: "a", voteCount: 0 },
      { id: "b", voteCount: 0 },
    ])
    expect(result).toEqual({ a: 0, b: 0 })
  })

  it("calcule des pourcentages arrondis dont la somme approche 100", () => {
    const result = computePollPercentages([
      { id: "a", voteCount: 2 },
      { id: "b", voteCount: 1 },
    ])
    expect(result).toEqual({ a: 67, b: 33 })
  })

  it("gère une seule option votée à 100 %", () => {
    const result = computePollPercentages([
      { id: "a", voteCount: 5 },
      { id: "b", voteCount: 0 },
      { id: "c", voteCount: 0 },
    ])
    expect(result).toEqual({ a: 100, b: 0, c: 0 })
  })
})
