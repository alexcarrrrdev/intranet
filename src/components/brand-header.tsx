import { connection } from "next/server"

import { getAppSettingsSummary } from "@/lib/settings/app-settings"
import { BrandMark } from "@/components/brand-mark"

// En-tête affiché au-dessus de la Card sur les trois pages publiques
// d'authentification (/, /mot-de-passe-oublie, /reinitialiser-mot-de-passe) :
// logo (ou icône par défaut) + nom de l'application, pour que ces pages
// restent cohérentes avec l'identité configurée dans
// /administration/general, avant même la connexion.
//
// Composant serveur : lit lui-même les paramètres (mémorisés via
// `cache()`, voir src/lib/settings/app-settings.ts) plutôt que de les
// recevoir en props, pour que les trois pages n'aient qu'à faire
// `<BrandHeader />` sans dupliquer cette lecture chacune de leur côté. Ces
// pages, jusqu'ici statiques ou presque, deviennent de ce fait rendues
// dynamiquement (accès base de données) — un compromis jugé acceptable
// pour un logo qui peut changer à tout moment.
export async function BrandHeader() {
  // `getAppSettingsSummary` interroge Postgres via `pg`/Drizzle, pas via
  // `fetch` : Next.js ne peut donc pas détecter automatiquement qu'il s'agit
  // de données dynamiques, et prérendrait sinon cette page une fois pour
  // toutes au build (voir node_modules/next/dist/docs/01-app/03-api-reference/
  // 04-functions/connection.md, section « Synchronous database drivers » —
  // le même principe s'applique aux pilotes asynchrones). `connection()`
  // force explicitement le rendu à la requête, pour que le logo/nom affiché
  // reste à jour sans nécessiter de reconstruction — sans cet appel, seule
  // /reinitialiser-mot-de-passe (qui lit `searchParams`) et / (qui lit la
  // session via `headers()`) seraient dynamiques ; /mot-de-passe-oublie,
  // qui n'a par ailleurs aucune autre raison de l'être, resterait figée au
  // contenu du dernier build.
  await connection()
  const { appName, hasLogo, logoVersion } = await getAppSettingsSummary()

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <BrandMark
        hasLogo={hasLogo}
        logoVersion={logoVersion}
        className="size-12"
        iconClassName="size-6"
      />
      <span className="text-lg font-semibold">{appName}</span>
    </div>
  )
}
