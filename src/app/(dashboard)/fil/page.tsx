import { redirect } from "next/navigation"

import { hasPermission } from "@/lib/auth/permissions"
import { getCurrentSession } from "@/lib/auth/session"
import { listUsers } from "@/lib/auth/users"
import { listAnnouncements } from "@/lib/announcements/announcements"
import { listUpcomingEvents } from "@/lib/events/events"
import { listFeedPosts } from "@/lib/feed/posts"
import { mergeFeedItems } from "@/lib/feed/merge-feed-items"
import { FeedComposer } from "@/components/feed/feed-composer"
import { UnifiedFeed } from "@/components/feed/unified-feed"

const FEED_PAGE_SIZE = 30
const ANNOUNCEMENT_ITEM_LIMIT = 10
const EVENT_ITEM_LIMIT = 5

// Page /fil : fil unifié à une seule colonne — annonces, événements à venir
// et posts (fil général + posts des groupes dont l'utilisateur est membre,
// voir listFeedPosts) apparaissent ensemble, triés par date décroissante
// (une annonce épinglée reste toujours en tête, voir mergeFeedItems). Le fil
// de groupe (/groupes/[id]) reste un fil de posts seulement, via
// PostList/FeedComposer directement.
export default async function FilPage() {
  const session = await getCurrentSession()

  if (!session) {
    redirect("/")
  }

  const [posts, announcements, events, users, canDeleteAny] = await Promise.all([
    listFeedPosts({
      groupId: null,
      currentUserId: session.user.id,
      limit: FEED_PAGE_SIZE,
      offset: 0,
    }),
    listAnnouncements({ currentUserId: session.user.id, includeReadStats: false }),
    listUpcomingEvents(),
    listUsers(),
    hasPermission(session.user, "post", "delete-any"),
  ])

  const employees = users
    .filter((user) => user.id !== session.user.id)
    .map((user) => ({ id: user.id, name: user.name, image: user.image }))

  const firstName = session.user.name.split(/\s+/)[0] ?? session.user.name
  const today = new Intl.DateTimeFormat("fr-CA", { dateStyle: "full" }).format(new Date())

  const items = mergeFeedItems({
    posts,
    announcements: announcements.slice(0, ANNOUNCEMENT_ITEM_LIMIT),
    events: events.slice(0, EVENT_ITEM_LIMIT),
  })

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bonjour {firstName} 👋</h1>
        <p className="text-sm text-muted-foreground first-letter:uppercase">{today}</p>
      </div>

      <FeedComposer
        groupId={null}
        currentUser={{ name: session.user.name, image: session.user.image ?? null }}
        employees={employees}
      />

      <UnifiedFeed
        initialItems={items}
        initialPostCount={posts.length}
        pageSize={FEED_PAGE_SIZE}
        currentUserId={session.user.id}
        canDeleteAny={canDeleteAny}
      />
    </div>
  )
}
