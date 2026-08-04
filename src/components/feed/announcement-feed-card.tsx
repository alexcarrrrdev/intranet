"use client"

import { useState, useTransition } from "react"
import { CheckIcon, MegaphoneIcon } from "lucide-react"
import { toast } from "sonner"

import { markAnnouncementReadAction } from "@/app/actions/announcements"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatRelativeTime } from "@/lib/dates"
import type { AnnouncementListItem } from "@/lib/announcements/announcements"

type AnnouncementFeedCardProps = {
  announcement: AnnouncementListItem
}

// Carte d'une annonce dans le fil unifié (/fil) : distincte des posts (pas
// de réactions/commentaires), pastille Megaphone, badge « Épinglée » si
// applicable, bouton « Marquer comme lue » qui appelle l'action serveur
// markAnnouncementReadAction (voir src/app/actions/announcements.ts).
export function AnnouncementFeedCard({ announcement }: AnnouncementFeedCardProps) {
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
    <Card className="border-primary/25 bg-primary/[0.03]">
      <CardContent className="flex flex-col gap-3 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MegaphoneIcon className="size-4.5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-primary uppercase">Annonce</span>
                {announcement.pinned && <Badge variant="secondary">Épinglée</Badge>}
              </div>
              <p className="font-semibold">{announcement.title}</p>
            </div>
          </div>
        </div>

        <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{announcement.body}</p>

        <div className="flex items-center justify-between gap-2 border-t pt-2.5 text-xs text-muted-foreground">
          <span>
            {announcement.authorName} · {formatRelativeTime(announcement.createdAt)}
          </span>
          {isRead ? (
            <span className="flex items-center gap-1 text-muted-foreground">
              <CheckIcon className="size-3.5" />
              Lue
            </span>
          ) : (
            <Button variant="outline" size="sm" disabled={isPending} onClick={handleMarkRead}>
              Marquer comme lue
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
