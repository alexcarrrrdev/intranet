import { NextResponse } from "next/server"

import { getCurrentSession } from "@/lib/auth/session"
import { getAvatar } from "@/lib/auth/avatar"

// Sert la photo de profil d'un utilisateur (voir src/lib/auth/avatar.ts),
// même patron que la route /logo (src/app/logo/route.ts) pour le logo de
// l'application, mais RÉSERVÉE aux utilisateurs connectés : contrairement
// au logo (affiché avant même la connexion, sur les pages publiques), une
// photo de profil n'a de sens qu'à l'intérieur de l'application (fil,
// annuaire, composeur...), déjà entièrement protégée par cookie de session
// (voir src/proxy.ts) — inutile de l'exposer publiquement, donc pas
// d'exclusion de "/avatar" dans le matcher du proxy : il s'applique déjà
// normalement à cette route, mais son contrôle n'est qu'« optimiste »
// (présence du cookie, voir le commentaire de src/proxy.ts), d'où la
// revérification COMPLÈTE de la session ci-dessous, qui fait autorité.
//
// N'importe quel utilisateur connecté peut voir la photo de N'IMPORTE QUEL
// autre utilisateur (même principe que l'annuaire, /annuaire) : ce n'est
// donc pas une vérification de propriété, seulement une vérification de
// connexion.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await getCurrentSession()
  if (!session) {
    return new NextResponse(null, { status: 401 })
  }

  const { userId } = await params
  const avatar = await getAvatar(userId)

  if (!avatar) {
    return new NextResponse(null, { status: 404 })
  }

  // Voir le commentaire équivalent dans src/app/logo/route.ts pour la
  // conversion Buffer -> Uint8Array (BodyInit) et l'absence volontaire des
  // en-têtes X-Content-Type-Options/Content-Security-Policy ici (posés par
  // next.config.ts). SVG n'étant pas un format accepté pour les photos de
  // profil (voir src/lib/settings/avatar-validation.ts), aucune sandbox CSP
  // n'est nécessaire pour cette route.
  return new NextResponse(new Uint8Array(avatar.data), {
    status: 200,
    headers: {
      "Content-Type": avatar.mimeType,
      // Sûr uniquement parce que l'URL est versionnée (`?v=<horodatage>`,
      // voir buildAvatarImageUrl dans src/lib/auth/avatar.ts) : toute
      // modification de la photo change la version, donc l'URL, donc
      // invalide implicitement ce cache — jamais besoin de purge explicite.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  })
}
