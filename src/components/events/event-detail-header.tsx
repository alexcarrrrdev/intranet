"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontalIcon } from "lucide-react"
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
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { RsvpButtons } from "@/components/events/rsvp-buttons"
import { formatDayOfMonth, formatShortMonth, formatTime } from "@/lib/dates"
import type { EventDetail } from "@/lib/events/events"

type EventDetailHeaderProps = {
  event: EventDetail
  canManage: boolean
}

// En-tête de contexte du fil filtré par événement (/fil?evenement=…) : bloc
// date, titre, heure/lieu/description, compteur de participants, boutons de
// participation, suppression (event:manage). La redirection après
// suppression revient à /fil (désélectionne le filtre).
export function EventDetailHeader({ event, canManage }: EventDetailHeaderProps) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      const result = await deleteEventAction({ eventId: event.id })
      if (result.error) {
        setError(result.error)
        return
      }
      toast.success("L'événement a été supprimé.")
      router.push("/fil")
    })
  }

  return (
    <Card>
      <CardContent className="flex items-start gap-4 py-4">
        <div className="flex w-14 shrink-0 flex-col items-center rounded-md bg-primary/10 py-2 text-primary">
          <span className="text-xl font-bold leading-none">{formatDayOfMonth(event.startsAt)}</span>
          <span className="text-xs uppercase">{formatShortMonth(event.startsAt)}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-lg font-semibold">{event.title}</h1>
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
                    <DropdownMenuItem variant="destructive" onClick={() => setConfirmOpen(true)}>
                      Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer cet événement ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        « {event.title} » et toutes ses publications seront définitivement
                        supprimés. Cette action est irréversible.
                        {error && <span className="mt-2 block text-destructive">{error}</span>}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={(clickEvent) => {
                          clickEvent.preventDefault()
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

          <RsvpButtons
            eventId={event.id}
            initialStatus={event.myRsvp}
            initialGoingCount={event.goingCount}
          />
        </div>
      </CardContent>
    </Card>
  )
}
