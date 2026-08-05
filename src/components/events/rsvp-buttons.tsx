"use client"

import { useState, useTransition } from "react"
import { CheckIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { rsvpAction } from "@/app/actions/events"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type RsvpButtonsProps = {
  eventId: string
  initialStatus: "going" | "declined" | null
  initialGoingCount: number
  size?: "sm" | "default"
}

// Boutons de participation à un événement (« Je participe » / « Je ne
// participe pas »), réutilisés dans le fil (/fil?evenement=…) et /calendrier
// — ouverts à tout utilisateur connecté (voir rsvpAction,
// src/app/actions/events.ts). État net : le bouton actif est mis en
// évidence, cliquer de nouveau dessus laisse la réponse inchangée (pas de
// bascule vers « sans réponse », un choix explicite reste explicite).
export function RsvpButtons({ eventId, initialStatus, initialGoingCount, size = "sm" }: RsvpButtonsProps) {
  const [status, setStatus] = useState(initialStatus)
  const [goingCount, setGoingCount] = useState(initialGoingCount)
  const [isPending, startTransition] = useTransition()

  function handleClick(next: "going" | "declined") {
    if (next === status) return
    const previousStatus = status
    const previousCount = goingCount

    setStatus(next)
    setGoingCount((count) => {
      let updated = count
      if (previousStatus === "going") updated -= 1
      if (next === "going") updated += 1
      return Math.max(0, updated)
    })

    startTransition(async () => {
      const result = await rsvpAction({ eventId, status: next })
      if (result.error) {
        toast.error(result.error)
        setStatus(previousStatus)
        setGoingCount(previousCount)
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size={size}
        variant={status === "going" ? "default" : "outline"}
        disabled={isPending}
        onClick={() => handleClick("going")}
        className={cn(status === "going" && "gap-1.5")}
      >
        {status === "going" && <CheckIcon className="size-4" />}
        Je participe
      </Button>
      <Button
        type="button"
        size={size}
        variant={status === "declined" ? "secondary" : "outline"}
        disabled={isPending}
        onClick={() => handleClick("declined")}
        className={cn(status === "declined" && "gap-1.5")}
      >
        {status === "declined" && <XIcon className="size-4" />}
        Je ne participe pas
      </Button>
      <span className="text-xs text-muted-foreground">
        {goingCount} participant{goingCount > 1 ? "s" : ""}
      </span>
    </div>
  )
}
