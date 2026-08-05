import Link from "next/link"
import { CalendarDaysIcon, MailIcon, NewspaperIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { NewGroupDialog } from "@/components/groups/new-group-dialog"
import { NewEventDialog } from "@/components/events/new-event-dialog"
import { formatDayOfMonth, formatShortMonth } from "@/lib/dates"
import type { GroupListItem, PendingInvitation } from "@/lib/groups/groups"
import type { EventListItem } from "@/lib/events/events"
import { cn } from "@/lib/utils"

type FeedLeftRailProps = {
  groups: GroupListItem[]
  events: EventListItem[]
  invitations: PendingInvitation[]
  activeGroupId: string | null
  activeEventId: string | null
  canManageGroups: boolean
  canManageEvents: boolean
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

const UPCOMING_EVENTS_LIMIT = 5

// Rail gauche de /fil : mes groupes (cliquables → filtre du fil), groupes à
// découvrir (avec rejoindre inline), et prochains événements (cliquables →
// filtre du fil), avec l'état de participation. Sticky sous `lg`, masqué en
// dessous (voir /fil/page.tsx).
export function FeedLeftRail({
  groups,
  events,
  invitations,
  activeGroupId,
  activeEventId,
  canManageGroups,
  canManageEvents,
}: FeedLeftRailProps) {
  const myGroups = groups.filter((group) => group.isMember)
  const otherGroups = groups.filter((group) => !group.isMember)
  const upcomingEvents = events.slice(0, UPCOMING_EVENTS_LIMIT)
  const noFilter = !activeGroupId && !activeEventId

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/fil"
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          noFilter ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
        )}
      >
        <NewspaperIcon className="size-4" />
        Fil d&apos;actualités
      </Link>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-3">
          <h2 className="text-xs font-semibold uppercase text-muted-foreground">Mes groupes</h2>
          {canManageGroups && <NewGroupDialog trigger="icon" />}
        </div>
        <div className="flex flex-col gap-0.5">
          {myGroups.length === 0 && (
            <p className="px-3 text-xs text-muted-foreground">Aucun groupe rejoint.</p>
          )}
          {myGroups.map((group) => (
            <Link
              key={group.id}
              href={`/fil?groupe=${group.id}`}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                activeGroupId === group.id
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-foreground hover:bg-muted",
              )}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                {initials(group.name)}
              </span>
              <span className="truncate">{group.name}</span>
            </Link>
          ))}
        </div>

        {invitations.length > 0 && (
          <div className="mt-1 flex flex-col gap-1 border-t pt-2">
            <h3 className="px-3 text-xs font-semibold uppercase text-muted-foreground">
              Invitations
            </h3>
            {invitations.map((invitation) => (
              <Link
                key={invitation.groupId}
                href={`/fil?groupe=${invitation.groupId}`}
                className="flex items-center justify-between gap-2 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-muted"
              >
                <span className="flex items-center gap-2 truncate">
                  <MailIcon className="size-3.5 shrink-0 text-primary" />
                  <span className="truncate">{invitation.groupName}</span>
                </span>
                <Badge variant="secondary" className="shrink-0 px-1.5 text-[10px]">
                  Nouveau
                </Badge>
              </Link>
            ))}
          </div>
        )}

        {otherGroups.length > 0 && (
          <div className="mt-1 flex flex-col gap-1 border-t pt-2">
            <h3 className="px-3 text-xs font-semibold uppercase text-muted-foreground">
              À découvrir
            </h3>
            {otherGroups.map((group) => (
              <div key={group.id} className="flex items-center justify-between gap-2 px-3 py-1">
                <span className="truncate text-sm">{group.name}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2 border-t pt-3">
        <div className="flex items-center justify-between px-3">
          <h2 className="text-xs font-semibold uppercase text-muted-foreground">Événements</h2>
          {canManageEvents && <NewEventDialog trigger="icon" />}
        </div>
        <div className="flex flex-col gap-0.5">
          {upcomingEvents.length === 0 && (
            <p className="px-3 text-xs text-muted-foreground">Aucun événement à venir.</p>
          )}
          {upcomingEvents.map((event) => (
            <Link
              key={event.id}
              href={`/fil?evenement=${event.id}`}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                activeEventId === event.id
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-foreground hover:bg-muted",
              )}
            >
              <span className="flex w-9 shrink-0 flex-col items-center rounded bg-muted py-0.5 text-primary">
                <span className="text-xs font-bold leading-none">
                  {formatDayOfMonth(event.startsAt)}
                </span>
                <span className="text-[9px] uppercase leading-none">
                  {formatShortMonth(event.startsAt)}
                </span>
              </span>
              <span className="min-w-0 flex-1 truncate">{event.title}</span>
              {event.myRsvp === "going" && (
                <Badge variant="secondary" className="shrink-0 px-1.5 text-[10px]">
                  ✓
                </Badge>
              )}
            </Link>
          ))}
        </div>
        <Button variant="link" size="sm" className="w-fit px-3 text-xs" render={<Link href="/calendrier" />}>
          <CalendarDaysIcon className="size-3.5" />
          Calendrier complet
        </Button>
      </section>
    </div>
  )
}
