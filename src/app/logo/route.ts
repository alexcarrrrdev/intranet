import { NextResponse } from "next/server"

import { getLogo } from "@/lib/settings/app-settings"

// Route publique (voir l'exclusion "logo" dans le matcher de src/proxy.ts) :
// sert le logo personnalisé de l'application, affiché avant même la
// connexion (barre latérale ET pages publiques comme /, voir
// src/components/brand-mark.tsx). Choisie en dehors de /api plutôt qu'en
// /api/logo : ce n'est pas un endpoint JSON programmatique mais une simple
// ressource binaire destinée à être consommée par un <img src="..." />, au
// même titre qu'un asset statique — /api reste réservé aux échanges
// applicatifs (ex. /api/auth).
//
// GET uniquement : c'est une lecture pure, jamais mise en cache par Next.js
// par défaut pour un Route Handler (voir node_modules/next/dist/docs/01-app/
// 01-getting-started/15-route-handlers.md, section Caching) — la fraîcheur
// est de toute façon garantie par le paramètre `?v=` (voir
// src/lib/settings/app-settings.ts, `logoVersion`), qui change dès que le
// logo est modifié : c'est ce paramètre, pas cette route, qui pilote le
// cache HTTP agressif ci-dessous.
export async function GET() {
  const logo = await getLogo()

  if (!logo) {
    return new NextResponse(null, { status: 404 })
  }

  // `Buffer` (retourné par le driver Postgres pour la colonne bytea, voir
  // src/lib/settings/app-settings.ts) n'est pas directement assignable au
  // type `BodyInit` attendu ici (TypeScript distingue son
  // `ArrayBufferLike` sous-jacent de l'`ArrayBuffer` concret exigé) : on le
  // convertit en `Uint8Array` standard, sans coût significatif vu la taille
  // plafonnée à 1 Mo (voir src/lib/settings/logo-validation.ts).
  //
  // X-Content-Type-Options: nosniff et Content-Security-Policy: sandbox sont
  // volontairement ABSENTS d'ici : posés par next.config.ts (voir son
  // commentaire sur cette route) plutôt qu'ici, car les en-têtes de
  // next.config.ts remplacent toujours ceux d'un Route Handler pour une même
  // clé (voir node_modules/next/dist/docs/01-app/03-api-reference/05-config/
  // 01-next-config-js/headers.md, « Header Overriding Behavior ») — les
  // définir aussi ici serait du code mort, silencieusement ignoré.
  return new NextResponse(new Uint8Array(logo.data), {
    status: 200,
    headers: {
      "Content-Type": logo.mimeType,
      // Sûr uniquement parce que l'URL est versionnée (`?v=<horodatage>`) :
      // toute modification du logo change la version, donc l'URL, donc
      // invalide implicitement ce cache — jamais besoin de purge explicite.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}
