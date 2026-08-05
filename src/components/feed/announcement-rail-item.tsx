"use client"

import { useState, useTransition } from "react"
import { PinIcon } from "lucide-react"
import { toast } from "sonner"

import { markAnnouncementReadAction } from "@/app/actions/announcements"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { AnnouncementListItem } from "@/lib/announcements/announcements"
import { formatRelativeTime } from "@/lib/dates"
import { cn } from "@/lib/utils"

type AnnouncementRailItemProps = {
  announcement: AnnouncementListItem
}

// Ligne d'annonce dans le rail droit de /fil : point vert si non lue, clic
// déplie le corps en place avec un bouton « Marquer comme lue » — l'annonce
// reste AUSSI affichée dans le fil central unifié (voir
// src/components/feed/announcement-feed-card.tsx), ceci n'est qu'un aperçu
// condensé.
export function AnnouncementRailItem({ announcement }: AnnouncementRailItemProps) {
  const [open, setOpen] = useState(false)
  const [isRead, setIsRead] = useState(announcement.isRead)
  const [isPending, startTransition] = useTransition()

  function handleMarkRead() {
    startTransition(async () => {
      const result = await markAnnouncementReadAction({ announcementId: announcement.id })
      if (result.error) {
        toast.error(result.error)
        return
      }
      setIsRead(true)
    })
  }

  return (
    <div className="flex flex-col gap-1 rounded-md px-3 py-1.5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-start gap-2 text-left"
      >
        <span
          className={cn(
            "mt-1.5 size-1.5 shrink-0 rounded-full",
            isRead ? "bg-transparent" : "bg-primary",
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{announcement.title}</span>
            {announcement.pinned && <PinIcon className="size-3 shrink-0 text-primary" />}
          </span>
          <span className="block text-xs text-muted-foreground">
            {formatRelativeTime(announcement.createdAt)}
          </span>
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-2 pl-3.5">
          <p className="text-xs whitespace-pre-wrap text-muted-foreground">{announcement.body}</p>
          <div className="flex items-center justify-between gap-2">
            {isRead ? (
              <span className="text-xs text-muted-foreground">Lue</span>
            ) : (
              <Button size="sm" variant="outline" disabled={isPending} onClick={handleMarkRead}>
                Marquer comme lue
              </Button>
            )}
            {announcement.readCount != null && (
              <Badge variant="secondary" className="text-[10px]">
                Lue par {announcement.readCount}/{announcement.totalUsers}
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
