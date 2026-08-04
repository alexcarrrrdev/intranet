// Fichier de setup du project "jsdom" (voir vitest.config.ts). Étend
// `expect` avec les matchers de @testing-library/jest-dom (toBeInTheDocument,
// toHaveTextContent, etc.), à la fois à l'exécution et pour les types
// TypeScript.
import "@testing-library/jest-dom/vitest"

import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

// jsdom n'implémente pas window.matchMedia : nécessaire dès qu'un composant
// dépend de useIsMobile (voir src/hooks/use-mobile.ts), utilisé par
// SidebarProvider. Toujours "non mobile" par défaut dans les tests.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
}

// @testing-library/react ne nettoie le DOM après chaque test automatiquement
// que si `afterEach` est une globale (mode `test.globals`), ce qui n'est pas
// le cas ici (imports explicites depuis "vitest" — voir vitest.config.ts).
// On le fait donc manuellement, une fois pour tous les tests du project
// "jsdom".
afterEach(() => {
  cleanup()
})
