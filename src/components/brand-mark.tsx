import { ShieldCheck } from "lucide-react"

import { cn } from "@/lib/utils"

type BrandMarkProps = {
  hasLogo: boolean
  // Horodatage de dernière modification des paramètres (voir
  // `logoVersion` dans src/lib/settings/app-settings.ts), utilisé comme
  // paramètre de cache-busting : `Cache-Control` sur /logo est agressif
  // (voir src/app/logo/route.ts), donc l'URL doit changer dès que le logo
  // change pour que le navigateur affiche la nouvelle image immédiatement.
  logoVersion: number
  className?: string
  iconClassName?: string
}

// Icône affichée dans l'en-tête de la barre latérale (src/components/app-sidebar.tsx)
// et au-dessus des pages publiques (src/components/brand-header.tsx) : le
// logo personnalisé s'il existe, sinon un repli par défaut (icône
// ShieldCheck dans un carré). Composant partagé pour garder l'apparence
// identique aux deux endroits, et réutilisable tel quel depuis un composant
// serveur (BrandHeader) ou client (AppSidebar) : il ne dépend d'aucun hook
// ni API navigateur.
export function BrandMark({
  hasLogo,
  logoVersion,
  className,
  iconClassName,
}: BrandMarkProps) {
  return (
    <div
      className={cn(
        "flex aspect-square shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary text-primary-foreground",
        className,
      )}
    >
      {hasLogo ? (
        // `next/image` optimise des images distantes ou volumineuses via un
        // pipeline de redimensionnement/reformatage ; le logo est une image
        // déjà petite (1 Mo maximum), servie par une route dynamique de même
        // origine (src/app/logo/route.ts) — l'optimisation n'apporterait
        // rien ici, seulement une complexité (chargeur d'image, config
        // `remotePatterns`) sans bénéfice. Un <img> simple avec des
        // dimensions explicites (via les classes de taille du conteneur)
        // suffit, d'où la désactivation ciblée de la règle ESLint.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/logo?v=${logoVersion}`}
          alt=""
          className="size-full object-contain"
        />
      ) : (
        <ShieldCheck className={cn("size-4", iconClassName)} />
      )}
    </div>
  )
}
