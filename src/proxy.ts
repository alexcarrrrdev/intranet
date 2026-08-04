import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Next.js 16 a renommé le fichier `middleware` en `proxy` (voir
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
//
// Vérification « optimiste » : on regarde seulement si le cookie de session
// est présent, sans requête à la base de données (rapide, exécuté sur
// (quasi) toutes les routes). La vérification qui fait autorité (session
// réellement valide en base) est faite dans src/app/(dashboard)/layout.tsx.
export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Exécuter sur toutes les routes SAUF :
     * - "/" (page de connexion)
     * - "/mot-de-passe-oublie" et "/reinitialiser-mot-de-passe" (flux public)
     * - "/logo" (image publique, affichée avant connexion — voir
     *   src/app/logo/route.ts)
     * - "/api" (dont /api/auth, utilisée par le flux de connexion lui-même)
     * - les fichiers statiques Next.js et le favicon
     *
     * Toute nouvelle page ajoutée sous (dashboard) est donc protégée par
     * défaut, sans avoir à modifier ce matcher.
     */
    "/((?!api|_next/static|_next/image|favicon.ico|logo|mot-de-passe-oublie|reinitialiser-mot-de-passe).+)",
  ],
};
