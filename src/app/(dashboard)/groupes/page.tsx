import { redirect } from "next/navigation"

// Page supprimée (voir le plan produit) : /fil est désormais le hub unique
// des groupes (rail gauche + /fil?groupe=…). Route conservée pour les
// signets existants.
export default function GroupesPage() {
  redirect("/fil")
}
