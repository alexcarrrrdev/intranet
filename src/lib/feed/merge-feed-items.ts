/**
 * Fusion/tri du fil unifié (/fil) : posts, annonces et événements chargés
 * séparément (voir page.tsx) sont combinés ici en une seule liste triée du
 * plus récent au plus ancien, avec une exception — une annonce épinglée
 * (`pinned: true`) apparaît TOUJOURS en tête, quelle que soit sa date.
 * Fonction pure, testée dans merge-feed-items.test.ts.
 */
import type { AnnouncementListItem } from "@/lib/announcements/announcements"
import type { EventListItem } from "@/lib/events/events"
import type { FeedPost } from "@/lib/feed/posts"

export type FeedItem =
  | { kind: "post"; date: Date; data: FeedPost }
  | { kind: "announcement"; date: Date; data: AnnouncementListItem }
  | { kind: "event"; date: Date; data: EventListItem }

/** Clé stable d'un item du fil, utilisée pour dédupliquer côté UI. */
export function feedItemKey(item: FeedItem): string {
  return `${item.kind}:${item.data.id}`
}

export function mergeFeedItems(params: {
  posts: FeedPost[]
  announcements: AnnouncementListItem[]
  events: EventListItem[]
}): FeedItem[] {
  const items: FeedItem[] = [
    ...params.posts.map((data): FeedItem => ({ kind: "post", date: data.createdAt, data })),
    ...params.announcements.map(
      (data): FeedItem => ({ kind: "announcement", date: data.createdAt, data }),
    ),
    // Le tri se fait sur `createdAt` de l'événement (date de création),
    // volontairement PAS sur `startsAt` (date de début de l'événement).
    ...params.events.map((data): FeedItem => ({ kind: "event", date: data.createdAt, data })),
  ]

  return items.sort((a, b) => {
    const aPinned = a.kind === "announcement" && a.data.pinned
    const bPinned = b.kind === "announcement" && b.data.pinned
    if (aPinned && !bPinned) return -1
    if (bPinned && !aPinned) return 1
    return b.date.getTime() - a.date.getTime()
  })
}
