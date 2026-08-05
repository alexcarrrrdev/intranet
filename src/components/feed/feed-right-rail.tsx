import Link from "next/link"
import { BookUserIcon, MegaphoneIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { AnnouncementRailItem } from "@/components/feed/announcement-rail-item"
import { NewAnnouncementDialog } from "@/components/announcements/new-announcement-dialog"
import type { AnnouncementListItem } from "@/lib/announcements/announcements"

export type DirectoryPreviewUser = {
  id: string
  name: string
  roleName: string
  image: string | null
}

type FeedRightRailProps = {
  announcements: AnnouncementListItem[]
  directoryPreview: DirectoryPreviewUser[]
  canManageAnnouncements: boolean
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

// Rail droit de /fil : dernières annonces (avec marquer-lu et compteur de
// lecture pour announcement:manage) et aperçu de l'annuaire. Sticky sous
// `lg`, masqué en dessous (voir /fil/page.tsx).
export function FeedRightRail({
  announcements,
  directoryPreview,
  canManageAnnouncements,
}: FeedRightRailProps) {
  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-3">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
            <MegaphoneIcon className="size-3.5" />
            Annonces
          </h2>
          {canManageAnnouncements && <NewAnnouncementDialog trigger="icon" />}
        </div>
        <div className="flex flex-col gap-0.5">
          {announcements.length === 0 && (
            <p className="px-3 text-xs text-muted-foreground">Aucune annonce.</p>
          )}
          {announcements.map((announcement) => (
            <AnnouncementRailItem key={announcement.id} announcement={announcement} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2 border-t pt-3">
        <h2 className="flex items-center gap-1.5 px-3 text-xs font-semibold uppercase text-muted-foreground">
          <BookUserIcon className="size-3.5" />
          Annuaire
        </h2>
        <div className="flex flex-col gap-1">
          {directoryPreview.map((person) => (
            <div key={person.id} className="flex items-center gap-2 px-3 py-1">
              <Avatar className="size-7">
                {person.image ? <AvatarImage src={person.image} alt={person.name} /> : null}
                <AvatarFallback className="text-[10px]">{initials(person.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm leading-tight">{person.name}</p>
                <p className="truncate text-xs leading-tight text-muted-foreground">
                  {person.roleName}
                </p>
              </div>
            </div>
          ))}
        </div>
        <Button variant="link" size="sm" className="w-fit px-3 text-xs" render={<Link href="/annuaire" />}>
          Tout l&apos;annuaire
        </Button>
      </section>
    </div>
  )
}
