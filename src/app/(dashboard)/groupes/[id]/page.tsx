import { notFound, redirect } from "next/navigation"

import { hasPermission } from "@/lib/auth/permissions"
import { getCurrentSession } from "@/lib/auth/session"
import { listUsers } from "@/lib/auth/users"
import { getGroupDetail } from "@/lib/groups/groups"
import { listFeedPosts } from "@/lib/feed/posts"
import { FeedComposer } from "@/components/feed/feed-composer"
import { PostList } from "@/components/feed/post-list"
import { GroupDetailHeader } from "@/components/groups/group-detail-header"

const FEED_PAGE_SIZE = 30

type GroupPageProps = {
  params: Promise<{ id: string }>
}

// Page /groupes/[id] : en-tête du groupe + fil du groupe, réutilisant
// FeedComposer/PostList (mêmes composants que /fil, avec groupId — voir
// leurs commentaires). Poster requiert d'être membre, vérifié côté serveur
// dans createXxxPostAction (src/app/actions/feed.ts, isGroupMember) — le
// composeur reste affiché à tous, l'appel serveur refuse la publication si
// non-membre.
export default async function GroupePage({ params }: GroupPageProps) {
  const { id } = await params
  const session = await getCurrentSession()

  if (!session) {
    redirect("/")
  }

  const group = await getGroupDetail(id, session.user.id)
  if (!group) {
    notFound()
  }

  const [posts, users, canDeleteAny, canManage] = await Promise.all([
    listFeedPosts({ groupId: id, currentUserId: session.user.id, limit: FEED_PAGE_SIZE, offset: 0 }),
    listUsers(),
    hasPermission(session.user, "post", "delete-any"),
    hasPermission(session.user, "group", "manage"),
  ])

  const employees = users
    .filter((user) => user.id !== session.user.id)
    .map((user) => ({ id: user.id, name: user.name, image: user.image }))

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <GroupDetailHeader group={group} canManage={canManage} />

      {group.isMember ? (
        <FeedComposer
          groupId={id}
          currentUser={{ name: session.user.name, image: session.user.image ?? null }}
          employees={employees}
        />
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          Rejoignez ce groupe pour y publier.
        </p>
      )}

      <PostList
        groupId={id}
        initialPosts={posts}
        pageSize={FEED_PAGE_SIZE}
        currentUserId={session.user.id}
        canDeleteAny={canDeleteAny}
      />
    </div>
  )
}
