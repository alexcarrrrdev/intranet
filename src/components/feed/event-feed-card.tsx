import Link from "next/link"

import { Card, CardContent } from "@/components/ui/card"
import { formatDayOfMonth, formatShortMonth, formatTime } from "@/lib/dates"
import type { EventListItem } from "@/lib/events/events"

type EventFeedCardProps = {
  event: EventListItem
}

// Carte compacte d'un événement à venir dans le fil unifié (/fil) : bloc
// date jour/mois repris du style de src/components/events/event-list.tsx,
// aucune interaction (pas de like/commentaire) — lien vers /calendrier.
export function EventFeedCard({ event }: EventFeedCardProps) {
  return (
    <Link href="/calendrier">
      <Card className="transition-colors hover:bg-muted/40">
        <CardContent className="flex items-center gap-4 py-4">
          <div className="flex w-14 shrink-0 flex-col items-center rounded-md bg-primary/10 py-2 text-primary">
            <span className="text-xl leading-none font-bold">{formatDayOfMonth(event.startsAt)}</span>
            <span className="text-xs uppercase">{formatShortMonth(event.startsAt)}</span>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs font-medium text-primary uppercase">Nouvel événement</span>
            <p className="truncate font-medium">{event.title}</p>
            <p className="text-sm text-muted-foreground">
              {event.allDay ? "Toute la journée" : formatTime(event.startsAt)}
              {event.location ? ` · ${event.location}` : ""}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
