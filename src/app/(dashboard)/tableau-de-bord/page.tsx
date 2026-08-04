import { redirect } from "next/navigation"

// Le tableau de bord du template a été remplacé par le fil d'actualités,
// qui sert de page d'accueil de l'intranet. La route est conservée en
// redirection pour les signets et les anciens liens.
export default function TableauDeBordPage() {
  redirect("/fil")
}
