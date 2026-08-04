import { z } from "zod"

// Schéma de validation des variables d'environnement serveur, évalué une
// seule fois au chargement de ce module. Objectif : échouer immédiatement et
// clairement (au démarrage, ou pendant `next build` qui évalue les modules
// serveur) plutôt que de laisser une variable manquante ou invalide
// provoquer une erreur cryptique plus tard — ex. Better Auth retombant sur
// un secret par défaut non sécurisé, ou une connexion Postgres qui échoue
// au premier appel seulement.
const envSchema = z.object({
  DATABASE_URL: z
    .string({ error: "DATABASE_URL est requis (voir .env.example)." })
    .refine((value) => /^postgres(ql)?:\/\//.test(value), {
      error:
        "DATABASE_URL doit être une URL de connexion PostgreSQL valide, de la forme postgresql://utilisateur:motdepasse@hote:port/base.",
    }),
  BETTER_AUTH_SECRET: z
    .string({ error: "BETTER_AUTH_SECRET est requis (voir .env.example)." })
    .min(32, {
      error:
        "BETTER_AUTH_SECRET doit contenir au moins 32 caractères. Générez-en un avec « openssl rand -base64 32 ».",
    }),
  BETTER_AUTH_URL: z.url({
    error:
      "BETTER_AUTH_URL est requis et doit être une URL valide (ex. http://localhost:3000).",
  }),
})

export type Env = z.infer<typeof envSchema>

/**
 * Valide un objet de variables d'environnement selon le schéma ci-dessus.
 * Séparée de l'appel au niveau du module (qui lit process.env) pour rester
 * testable sans avoir à manipuler process.env global — voir
 * src/lib/env.test.ts.
 *
 * Lance une erreur listant chaque variable manquante ou invalide, avec une
 * explication actionable, plutôt qu'un simple échec de validation Zod.
 */
export function parseEnv(input: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(input)

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "?"} : ${issue.message}`)
      .join("\n")

    throw new Error(
      [
        "Configuration invalide : une ou plusieurs variables d'environnement sont manquantes ou incorrectes.",
        details,
        "",
        "Consultez .env.example pour la liste complète des variables attendues et leur format.",
      ].join("\n"),
    )
  }

  return result.data
}

// Évaluée une seule fois, au premier import de ce module (par ex. par
// src/db/index.ts ou src/lib/auth/index.ts) : échoue immédiatement si
// l'environnement est invalide, plutôt que de laisser l'erreur survenir
// plus tard, au premier usage réel de la variable manquante.
export const env: Readonly<Env> = Object.freeze(parseEnv(process.env))
