"use client"

import { useState, useTransition } from "react"
import { NewspaperIcon } from "lucide-react"

import { loadMoreFeedPostsAction } from "@/app/actions/feed"
import { PostCard } from "@/components/feed/post-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { FeedPost } from "@/lib/feed/posts"

type PostListProps = {
  groupId: string | null
  initialPosts: FeedPost[]
  pageSize: number
  currentUserId: string
  canDeleteAny: boolean
}

// Liste des publications du fil, avec un bouton « Voir plus » (pagination
// simple par décalage) plutôt qu'un défilement infini — voir le plan
// produit. Réutilisé tel quel par /fil et /groupes/[id].
export function PostList({
  groupId,
  initialPosts,
  pageSize,
  currentUserId,
  canDeleteAny,
}: PostListProps) {
  const [posts, setPosts] = useState(initialPosts)
  const [hasMore, setHasMore] = useState(initialPosts.length === pageSize)
  const [isPending, startTransition] = useTransition()

  // `initialPosts` change à chaque rendu du composant serveur parent (voir
  // `refresh()` après chaque mutation, ex. src/app/actions/feed.ts) — utile
  // notamment pour faire apparaître un nouveau post juste publié sans que
  // l'auteur ait à recharger la page. On fusionne plutôt que de remplacer :
  // remplacer perdrait les pages chargées via « Voir plus », qui ne font pas
  // partie de cette première page renvoyée par le serveur. Ajustement fait
  // PENDANT le rendu (pas dans un effet) — même technique que
  // src/components/app-sidebar.tsx (NavItemWithSubmenu) pour réagir à un
  // changement de prop sans cascade de rendus superflue.
  const [prevInitialPosts, setPrevInitialPosts] = useState(initialPosts)
  if (initialPosts !== prevInitialPosts) {
    setPrevInitialPosts(initialPosts)
    const existingIds = new Set(posts.map((p) => p.id))
    const newHeadPosts = initialPosts.filter((p) => !existingIds.has(p.id))
    if (newHeadPosts.length > 0) {
      setPosts([...newHeadPosts, ...posts])
    }
  }

  function handleLoadMore() {
    startTransition(async () => {
      const result = await loadMoreFeedPostsAction({ groupId, offset: posts.length })
      setPosts((prev) => [...prev, ...result.posts])
      setHasMore(result.posts.length === pageSize)
    })
  }

  if (posts.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <NewspaperIcon className="size-8" />
          <p className="text-sm">
            Aucune publication pour le moment. Soyez la première personne à
            partager quelque chose !
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={currentUserId}
          canDeleteAny={canDeleteAny}
        />
      ))}
      {hasMore && (
        <Button variant="outline" onClick={handleLoadMore} disabled={isPending} className="mx-auto">
          Voir plus
        </Button>
      )}
    </div>
  )
}
