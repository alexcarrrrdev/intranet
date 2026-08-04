import { Skeleton } from "@/components/ui/skeleton"

// Affiché pendant le rendu serveur d'une page du tableau de bord.
//
// Sans ce fichier, le navigateur reste sur la page précédente sans aucun
// retour visuel jusqu'à ce que le serveur réponde : le clic semble ignoré.
// Ce squelette s'affiche instantanément et laisse la barre latérale et la
// barre supérieure en place, seul le contenu étant remplacé.
//
// Pour un squelette plus fidèle à une page en particulier, ajouter un
// `loading.tsx` dans le dossier de cette page : Next.js utilise toujours le
// plus proche de la route rendue.
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-56" />
      <div className="flex flex-col gap-3 rounded-xl border p-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
        <Skeleton className="mt-2 h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  )
}
