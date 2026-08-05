import { redirect } from "next/navigation"

type GroupePageProps = {
  params: Promise<{ id: string }>
}

// Page supprimée (voir le plan produit) : le fil d'un groupe vit désormais
// dans /fil?groupe=<id>. Route conservée pour les signets existants.
export default async function GroupePage({ params }: GroupePageProps) {
  const { id } = await params
  redirect(`/fil?groupe=${id}`)
}
