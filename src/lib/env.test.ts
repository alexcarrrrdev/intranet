import { describe, expect, it } from "vitest"

import { parseEnv } from "@/lib/env"

// Ces tests couvrent uniquement `parseEnv`, qui prend un objet en entrée et
// ne touche jamais process.env — voir src/lib/env.ts. La constante `env`
// exportée par ce module (elle, basée sur process.env) est exercée
// indirectement à chaque test de ce projet grâce à vitest.setup.env.ts, qui
// charge .env avant l'import des modules qui en dépendent (ex.
// src/lib/settings/app-settings.ts, qui importe @/db).

const validInput = {
  DATABASE_URL: "postgresql://user:password@localhost:5433/admin_template",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
}

describe("parseEnv", () => {
  it("accepte un environnement valide et retourne les valeurs telles quelles", () => {
    expect(parseEnv(validInput)).toEqual(validInput)
  })

  it("accepte une URL de connexion postgres:// (sans le ql)", () => {
    const input = { ...validInput, DATABASE_URL: "postgres://user:password@localhost:5433/db" }
    expect(parseEnv(input)).toEqual(input)
  })

  it("rejette un BETTER_AUTH_SECRET manquant, avec un message en français nommant la variable", () => {
    const input = {
      DATABASE_URL: validInput.DATABASE_URL,
      BETTER_AUTH_URL: validInput.BETTER_AUTH_URL,
    }

    expect(() => parseEnv(input)).toThrowError(/BETTER_AUTH_SECRET/)
    expect(() => parseEnv(input)).toThrowError(/requis/i)
  })

  it("rejette un BETTER_AUTH_SECRET trop court, avec un message en français nommant la variable", () => {
    const input = { ...validInput, BETTER_AUTH_SECRET: "trop-court" }

    expect(() => parseEnv(input)).toThrowError(/BETTER_AUTH_SECRET/)
    expect(() => parseEnv(input)).toThrowError(/32 caractères/)
    expect(() => parseEnv(input)).toThrowError(/openssl rand -base64 32/)
  })

  it("rejette un DATABASE_URL mal formé, avec un message en français nommant la variable", () => {
    const input = { ...validInput, DATABASE_URL: "mysql://user:password@localhost:3306/db" }

    expect(() => parseEnv(input)).toThrowError(/DATABASE_URL/)
    expect(() => parseEnv(input)).toThrowError(/PostgreSQL/)
  })

  it("rejette un DATABASE_URL manquant, avec un message en français nommant la variable", () => {
    const input = {
      BETTER_AUTH_SECRET: validInput.BETTER_AUTH_SECRET,
      BETTER_AUTH_URL: validInput.BETTER_AUTH_URL,
    }

    expect(() => parseEnv(input)).toThrowError(/DATABASE_URL/)
    expect(() => parseEnv(input)).toThrowError(/requis/i)
  })

  it("rejette un BETTER_AUTH_URL manquant ou invalide, avec un message en français nommant la variable", () => {
    const missing = { ...validInput, BETTER_AUTH_URL: undefined }
    const malformed = { ...validInput, BETTER_AUTH_URL: "pas-une-url" }

    expect(() => parseEnv(missing)).toThrowError(/BETTER_AUTH_URL/)
    expect(() => parseEnv(malformed)).toThrowError(/BETTER_AUTH_URL/)
  })

  it("liste chaque variable en cause quand plusieurs sont invalides à la fois", () => {
    try {
      parseEnv({ DATABASE_URL: "mysql://x", BETTER_AUTH_SECRET: "court" })
      expect.unreachable("parseEnv aurait dû lancer une erreur")
    } catch (error) {
      const message = (error as Error).message
      expect(message).toMatch(/DATABASE_URL/)
      expect(message).toMatch(/BETTER_AUTH_SECRET/)
      expect(message).toMatch(/BETTER_AUTH_URL/)
      expect(message).toMatch(/\.env\.example/)
    }
  })
})
