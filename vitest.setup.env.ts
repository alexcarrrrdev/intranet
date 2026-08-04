// Setup partagé par les projects "node" et "jsdom" (voir vitest.config.mts).
//
// Certains modules purement logiques (ex. src/lib/settings/app-settings.ts) importent
// tout de même `@/db` en haut de fichier — uniquement pour son typage ou par
// habitude d'écriture — même quand le test qui les couvre n'exerce aucune
// requête réelle. Or `@/db` importe désormais `@/lib/env` (voir
// src/lib/env.ts), qui valide les variables d'environnement serveur dès son
// chargement et lance une erreur si elles sont absentes.
//
// On charge donc .env ici, avant l'import des fichiers de test, exactement
// comme scripts/create-admin.ts et les tests d'intégration le font pour les
// modules qu'ils importent explicitement. Cela ne rend pas la validation
// paresseuse : `next build` et `next dev`, eux, n'ont pas ce setup et
// échoueront toujours immédiatement si l'environnement réel est invalide.
try {
  process.loadEnvFile()
} catch {
  // Pas de fichier .env trouvé (ex. CI où les variables sont injectées
  // directement dans l'environnement) : on continue sans erreur.
}
