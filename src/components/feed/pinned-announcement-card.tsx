import Link from "next/link"
import { PinIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"

type PinnedAnnouncementCardProps = {
  title: string
}

// Petit rappel en haut du fil quand au moins une annonce est épinglée (voir
// le plan produit) — lien vers /annonces, pas de contenu dupliqué ici.
export function PinnedAnnouncementCard({ title }: PinnedAnnouncementCardProps) {
  return (
    <Link href="/annonces">
      <Card className="border-primary/40 bg-primary/5 transition-colors hover:bg-primary/10">
        <CardContent className="flex items-center gap-2 py-3 text-sm">
          <PinIcon className="size-4 shrink-0 text-primary" />
          <span className="text-muted-foreground">Annonce épinglée :</span>
          <span className="truncate font-medium">{title}</span>
        </CardContent>
      </Card>
    </Link>
  )
}
