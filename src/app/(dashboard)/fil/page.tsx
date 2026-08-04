import { redirect } from "next/navigation"

import { hasPermission } from "@/lib/auth/permissions"
import { getCurrentSession } from "@/lib/auth/session"
import { listUsers } from "@/lib/auth/users"
import { listPinnedAnnouncements } from "@/lib/announcements/announcements"
import { listFeedPosts } from "@/lib/feed/posts"
import { FeedComposer } from "@/components/feed/feed-composer"
import { PinnedAnnouncementCard } from "@/components/feed/pinned-announcement-card"
import { PostList } from "@/components/feed/post-list"

const FEED_PAGE_SIZE = 30

// Page /fil : composeur + fil général (groupId null). Le fil de groupe
// (/groupes/[id], phase suivante) réutilise PostList/FeedComposer avec un
// groupId — voir leurs commentaires.
export default async function FilPage() {
  const session = await getCurrentSession()

  if (!session) {
    redirect("/")
  }

  const [posts, pinnedAnnouncements, users, canDeleteAny] = await Promise.all([
    listFeedPosts({ groupId: null, currentUserId: session.user.id, limit: FEED_PAGE_SIZE, offset: 0 }),
    listPinnedAnnouncements(),
    listUsers(),
    hasPermission(session.user, "post", "delete-any"),
  ])

  const employees = users
    .filter((user) => user.id !== session.user.id)
    .map((user) => ({ id: user.id, name: user.name, image: user.image }))

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      {pinnedAnnouncements.map((announcement) => (
        <PinnedAnnouncementCard key={announcement.id} title={announcement.title} />
      ))}

      <FeedComposer
        groupId={null}
        currentUser={{ name: session.user.name, image: session.user.image ?? null }}
        employees={employees}
      />

      <PostList
        groupId={null}
        initialPosts={posts}
        pageSize={FEED_PAGE_SIZE}
        currentUserId={session.user.id}
        canDeleteAny={canDeleteAny}
      />
    </div>
  )
}
