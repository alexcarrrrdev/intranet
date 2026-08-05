import { redirect } from "next/navigation"

import { hasPermission } from "@/lib/auth/permissions"
import { getCurrentSession } from "@/lib/auth/session"
import { listUsers } from "@/lib/auth/users"
import { listAnnouncements } from "@/lib/announcements/announcements"
import { getEventDetail, listUpcomingEvents } from "@/lib/events/events"
import { getGroupDetail, listGroups } from "@/lib/groups/groups"
import { listFeedPosts, type FeedScope } from "@/lib/feed/posts"
import { mergeFeedItems } from "@/lib/feed/merge-feed-items"
import { FeedComposer } from "@/components/feed/feed-composer"
import { FeedLeftRail } from "@/components/feed/feed-left-rail"
import { FeedRightRail } from "@/components/feed/feed-right-rail"
import { PostList } from "@/components/feed/post-list"
import { UnifiedFeed } from "@/components/feed/unified-feed"
import { GroupDetailHeader } from "@/components/groups/group-detail-header"
import { EventDetailHeader } from "@/components/events/event-detail-header"

const FEED_PAGE_SIZE = 30
const ANNOUNCEMENT_ITEM_LIMIT = 10
const EVENT_ITEM_LIMIT = 5
const ANNOUNCEMENT_RAIL_LIMIT = 5
const DIRECTORY_PREVIEW_LIMIT = 5

type FilPageProps = {
  searchParams: Promise<{ groupe?: string; evenement?: string }>
}

// Page /fil : hub unique de l'intranet (voir le plan produit), disposition
// 3 colonnes façon Facebook — rail gauche (mes groupes + événements), fil
// central (unifié en mode général, filtré par groupe/événement sinon), rail
// droit (annonces + aperçu annuaire). Les anciennes pages /groupes et
// /annonces redirigent désormais ici (voir leurs page.tsx).
export default async function FilPage({ searchParams }: FilPageProps) {
  const { groupe: groupeId, evenement: evenementId } = await searchParams
  const session = await getCurrentSession()

  if (!session) {
    redirect("/")
  }

  // Un post appartient à UN SEUL contexte : si les deux paramètres sont
  // fournis (URL forgée), on ignore silencieusement et retombe sur le
  // premier — la validation qui fait autorité reste côté scope ci-dessous.
  let scope: FeedScope = { type: "general" }
  if (groupeId) scope = { type: "group", id: groupeId }
  else if (evenementId) scope = { type: "event", id: evenementId }

  // Validation de la sélection : un groupe/événement inexistant redirige
  // vers /fil non filtré plutôt que d'afficher une page cassée.
  const [groupDetail, eventDetail] = await Promise.all([
    scope.type === "group" ? getGroupDetail(scope.id, session.user.id) : Promise.resolve(null),
    scope.type === "event" ? getEventDetail(scope.id, session.user.id) : Promise.resolve(null),
  ])
  if (scope.type === "group" && !groupDetail) redirect("/fil")
  if (scope.type === "event" && !eventDetail) redirect("/fil")

  const canManageAnnouncements = await hasPermission(session.user, "announcement", "manage")

  const [posts, announcements, upcomingEvents, groups, users, canDeleteAny, canManageGroups, canManageEvents] =
    await Promise.all([
      listFeedPosts({
        scope,
        currentUserId: session.user.id,
        limit: FEED_PAGE_SIZE,
        offset: 0,
      }),
      listAnnouncements({ currentUserId: session.user.id, includeReadStats: canManageAnnouncements }),
      listUpcomingEvents(session.user.id),
      listGroups(session.user.id),
      listUsers(),
      hasPermission(session.user, "post", "delete-any"),
      hasPermission(session.user, "group", "manage"),
      hasPermission(session.user, "event", "manage"),
    ])

  const employees = users
    .filter((user) => user.id !== session.user.id)
    .map((user) => ({ id: user.id, name: user.name, image: user.image }))

  const directoryPreview = users
    .filter((user) => user.id !== session.user.id)
    .slice(0, DIRECTORY_PREVIEW_LIMIT)
    .map((user) => ({ id: user.id, name: user.name, roleName: user.roleName, image: user.image }))

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_300px]">
      <aside className="hidden lg:sticky lg:top-20 lg:block lg:h-fit lg:self-start">
        <FeedLeftRail
          groups={groups}
          events={upcomingEvents}
          activeGroupId={scope.type === "group" ? scope.id : null}
          activeEventId={scope.type === "event" ? scope.id : null}
          canManageGroups={canManageGroups}
          canManageEvents={canManageEvents}
        />
      </aside>

      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        {scope.type === "general" && (
          <FilGeneralHeader name={session.user.name} />
        )}

        {scope.type === "group" && groupDetail && (
          <GroupDetailHeader group={groupDetail} canManage={canManageGroups} />
        )}

        {scope.type === "event" && eventDetail && (
          <EventDetailHeader event={eventDetail} canManage={canManageEvents} />
        )}

        {scope.type === "group" && groupDetail && !groupDetail.isMember ? (
          <p className="text-center text-sm text-muted-foreground">
            Rejoignez ce groupe pour y publier.
          </p>
        ) : (
          <FeedComposer
            groupId={scope.type === "group" ? scope.id : null}
            eventId={scope.type === "event" ? scope.id : null}
            currentUser={{ name: session.user.name, image: session.user.image ?? null }}
            employees={employees}
          />
        )}

        {scope.type === "general" ? (
          <UnifiedFeed
            initialItems={mergeFeedItems({
              posts,
              announcements: announcements.slice(0, ANNOUNCEMENT_ITEM_LIMIT),
              events: upcomingEvents.slice(0, EVENT_ITEM_LIMIT),
            })}
            initialPostCount={posts.length}
            pageSize={FEED_PAGE_SIZE}
            currentUserId={session.user.id}
            canDeleteAny={canDeleteAny}
          />
        ) : (
          <PostList
            scope={scope}
            initialPosts={posts}
            pageSize={FEED_PAGE_SIZE}
            currentUserId={session.user.id}
            canDeleteAny={canDeleteAny}
          />
        )}
      </main>

      <aside className="hidden xl:sticky xl:top-20 xl:block xl:h-fit xl:self-start">
        <FeedRightRail
          announcements={announcements.slice(0, ANNOUNCEMENT_RAIL_LIMIT)}
          directoryPreview={directoryPreview}
          canManageAnnouncements={canManageAnnouncements}
        />
      </aside>
    </div>
  )
}

function FilGeneralHeader({ name }: { name: string }) {
  const firstName = name.split(/\s+/)[0] ?? name
  const today = new Intl.DateTimeFormat("fr-CA", { dateStyle: "full" }).format(new Date())
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Bonjour {firstName} 👋</h1>
      <p className="text-sm text-muted-foreground first-letter:uppercase">{today}</p>
    </div>
  )
}
