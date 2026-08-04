"use client"

import { useState, useTransition } from "react"
import { CheckIcon, MegaphoneIcon, MoreHorizontalIcon, PinIcon, UsersIcon } from "lucide-react"
import { toast } from "sonner"

import {
  deleteAnnouncementAction,
  getAnnouncementReadersAction,
  markAnnouncementReadAction,
  setAnnouncementPinnedAction,
} from "@/app/actions/announcements"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { AnnouncementListItem, AnnouncementReader } from "@/lib/announcements/announcements"
import { formatShortDateTime } from "@/lib/dates"

type AnnouncementsListProps = {
  announcements: AnnouncementListItem[]
  canManage: boolean
}

export function AnnouncementsList({ announcements, canManage }: AnnouncementsListProps) {
  if (announcements.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <MegaphoneIcon className="size-8" />
          <p className="text-sm">
            Aucune annonce publiée pour l&apos;instant. Revenez plus tard !
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {announcements.map((announcement) => (
        <AnnouncementCard key={announcement.id} announcement={announcement} canManage={canManage} />
      ))}
    </div>
  )
}

function AnnouncementCard({
  announcement,
  canManage,
}: {
  announcement: AnnouncementListItem
  canManage: boolean
}) {
  const [isRead, setIsRead] = useState(announcement.isRead)
  const [deleted, setDeleted] = useState(false)
  const [readers, setReaders] = useState<AnnouncementReader[] | null>(null)
  const [isPending, startTransition] = useTransition()

  if (deleted) return null

  function handleMarkRead() {
    setIsRead(true)
    startTransition(async () => {
      const result = await markAnnouncementReadAction({ announcementId: announcement.id })
      if (result.error) {
        toast.error(result.error)
        setIsRead(false)
      }
    })
  }

  function handleTogglePin() {
    startTransition(async () => {
      const result = await setAnnouncementPinnedAction({
        announcementId: announcement.id,
        pinned: !announcement.pinned,
      })
      if (result.error) toast.error(result.error)
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteAnnouncementAction({ announcementId: announcement.id })
      if (result.error) {
        toast.error(result.error)
        return
      }
      setDeleted(true)
    })
  }

  async function handleOpenReaders() {
    if (readers) return
    const result = await getAnnouncementReadersAction({ announcementId: announcement.id })
    setReaders(result.readers)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{announcement.title}</CardTitle>
            {announcement.pinned && (
              <Badge variant="secondary" className="gap-1">
                <PinIcon className="size-3" />
                Épinglée
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {announcement.authorName} · {formatShortDateTime(announcement.createdAt)}
          </p>
        </div>
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon" className="size-8">
                  <MoreHorizontalIcon className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleTogglePin}>
                {announcement.pinned ? "Désépingler" : "Épingler"}
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={handleDelete}>
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm whitespace-pre-wrap">{announcement.body}</p>

        <div className="flex items-center justify-between gap-2">
          {isRead ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckIcon className="size-3.5 text-primary" />
              Lue
            </span>
          ) : (
            <Button size="sm" variant="outline" onClick={handleMarkRead} disabled={isPending}>
              Marquer comme lue
            </Button>
          )}

          {canManage && announcement.readCount != null && (
            <Popover onOpenChange={(open) => open && handleOpenReaders()}>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <UsersIcon className="size-3.5" />
                    Lue par {announcement.readCount}/{announcement.totalUsers}
                  </button>
                }
              />
              <PopoverContent align="end" className="w-64">
                {readers === null ? (
                  <p className="text-sm text-muted-foreground">Chargement…</p>
                ) : readers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Personne n&apos;a encore lu cette annonce.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {readers.map((reader) => (
                      <li key={reader.id} className="text-sm">
                        {reader.name}
                      </li>
                    ))}
                  </ul>
                )}
              </PopoverContent>
            </Popover>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
