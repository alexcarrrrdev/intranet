import { redirect } from "next/navigation"

// Page supprimée (voir le plan produit) : les annonces vivent désormais
// dans le rail droit de /fil (et dans le fil central unifié). Route
// conservée pour les signets existants.
export default function AnnoncesPage() {
  redirect("/fil")
}
