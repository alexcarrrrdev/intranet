import path from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

// Configuration Vitest du template, pensée pour être dupliquée telle quelle
// dans chaque projet client. Trois "projects" (fonctionnalité workspace de
// Vitest, voir https://vitest.dev/guide/projects) :
//
//   - "node"        : tests unitaires backend purs (pas de DOM, pas de DB).
//   - "jsdom"        : tests de composants React (DOM simulé).
//   - "integration" : tests backend contre une vraie base Postgres locale.
//
// `npm test` exécute "node" et "jsdom" (voir package.json : --project=!integration).
// `npm run test:integration` exécute uniquement "integration".
//
// Pour ajouter une nouvelle catégorie de tests, ajouter une entrée à ce
// tableau plutôt que de créer un fichier de config séparé.
const alias = {
  "@": path.resolve(import.meta.dirname, "./src"),
}

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.integration.test.ts"],
          setupFiles: ["./vitest.setup.env.ts"],
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./vitest.setup.env.ts", "./vitest.setup.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["src/**/*.integration.test.ts"],
          // Les appels réseau vers Postgres peuvent être plus lents qu'un
          // test unitaire : on laisse un peu plus de marge.
          testTimeout: 15_000,
          // Un seul worker : évite d'ouvrir trop de connexions Postgres en
          // parallèle et rend l'ordre des logs plus lisible en cas d'échec.
          fileParallelism: false,
        },
      },
    ],
  },
})
