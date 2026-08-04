"use client"

import { useState, useTransition } from "react"
import { CalendarDaysIcon, MoreHorizontalIcon } from "lucide-react"
import { toast } from "sonner"

import { deleteEventAction } from "@/app/actions/events"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { formatDayOfMonth, formatShortMonth, formatTime } from "@/lib/dates"
import type { EventListItem } from "@/lib/events/events"

type EventListProps = {
  events: EventListItem[]
  canManage: boolean
}

// Regroupe les événements (déjà triés par `startsAt` croissant, voir
// listUpcomingEvents) par mois civil — clé "année-mois" pour distinguer
// deux occurrences du même mois d'années différentes.
function groupByMonth(events: EventListItem[]): { key: string; label: string; events: EventListItem[] }[] {
  const groups = new Map<string, { label: string; events: EventListItem[] }>()

  for (const event of events) {
    const date = event.startsAt
    const key = `${date.getFullYear()}-${date.getMonth()}`
    const label = date.toLocaleDateString("fr-CA", { month: "long", year: "numeric" })
    const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1)
    if (!groups.has(key)) groups.set(key, { label: capitalizedLabel, events: [] })
    groups.get(key)!.events.push(event)
  }

  return Array.from(groups.entries()).map(([key, value]) => ({ key, ...value }))
}

export function EventList({ events, canManage }: EventListProps) {
  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <CalendarDaysIcon className="size-8" />
          <p className="text-sm">
            Aucun événement à venir pour le moment.
          </p>
        </CardContent>
      </Card>
    )
  }

  const groups = groupByMonth(events)

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.key} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">{group.label}</h2>
          <div className="flex flex-col gap-3">
            {group.events.map((event) => (
              <EventCard key={event.id} event={event} canManage={canManage} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function EventCard({ event, canManage }: { event: EventListItem; canManage: boolean }) {
  const [deleted, setDeleted] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (deleted) return null

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      const result = await deleteEventAction({ eventId: event.id })
      if (result.error) {
        setError(result.error)
        return
      }
      setConfirmOpen(false)
      setDeleted(true)
      toast.success("L'événement a été supprimé.")
    })
  }

  return (
    <Card>
      <CardContent className="flex items-start gap-4 py-4">
        <div className="flex w-14 shrink-0 flex-col items-center rounded-md bg-primary/10 py-2 text-primary">
          <span className="text-xl font-bold leading-none">{formatDayOfMonth(event.startsAt)}</span>
          <span className="text-xs uppercase">{formatShortMonth(event.startsAt)}</span>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium">{event.title}</h3>
            {canManage && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="ghost" size="icon" className="size-8 shrink-0">
                        <MoreHorizontalIcon className="size-4" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setConfirmOpen(true)}
                    >
                      Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer cet événement ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        « {event.title} » sera définitivement supprimé. Cette action est
                        irréversible.
                        {error && <span className="mt-2 block text-destructive">{error}</span>}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={(event) => {
                          event.preventDefault()
                          handleDelete()
                        }}
                        disabled={isPending}
                      >
                        Supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {event.allDay ? (
              <Badge variant="secondary">Toute la journée</Badge>
            ) : (
              <span>
                {formatTime(event.startsAt)}
                {event.endsAt ? ` – ${formatTime(event.endsAt)}` : ""}
              </span>
            )}
            {event.location && <span>· {event.location}</span>}
          </div>
          {event.description && <p className="text-sm">{event.description}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
