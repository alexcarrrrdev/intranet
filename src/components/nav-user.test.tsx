import { describe, expect, it } from "vitest"

import { getInitials } from "@/components/nav-user"

describe("getInitials", () => {
  it("prend la première lettre des deux premiers mots du nom", () => {
    expect(getInitials("Alex Caron", "alex@exemple.com")).toBe("AC")
  })

  it("ne retourne qu'une lettre pour un nom composé d'un seul mot", () => {
    expect(getInitials("Alex", "alex@exemple.com")).toBe("A")
  })

  it("ignore les mots au-delà des deux premiers", () => {
    expect(getInitials("Alex Jean Caron", "alex@exemple.com")).toBe("AJ")
  })

  it("se rabat sur la première lettre du courriel quand le nom est vide", () => {
    expect(getInitials("", "alex@exemple.com")).toBe("A")
  })

  it("se rabat sur la première lettre du courriel quand le nom ne contient que des espaces", () => {
    expect(getInitials("   ", "béa@exemple.com")).toBe("B")
  })

  it("met toujours la lettre issue du courriel en majuscule", () => {
    expect(getInitials("", "zoe@exemple.com")).toBe("Z")
  })
})
