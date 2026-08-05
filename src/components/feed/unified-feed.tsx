"use client"

import { useState, useTransition } from "react"
import { NewspaperIcon } from "lucide-react"

import { loadMoreFeedPostsAction } from "@/app/actions/feed"
import { AnnouncementFeedCard } from "@/components/feed/announcement-feed-card"
import { EventFeedCard } from "@/components/feed/event-feed-card"
import { PostCard } from "@/components/feed/post-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { feedItemKey, type FeedItem } from "@/lib/feed/merge-feed-items"

type UnifiedFeedProps = {
  initialItems: FeedItem[]
  // Nombre de posts inclus dans `initialItems` — sert de décalage pour
  // « Voir plus », qui ne pagine QUE les posts (les annonces/événements
  // au-delà de leurs propres limites vivent sur /annonces et /calendrier).
  initialPostCount: number
  pageSize: number
  currentUserId: string
  canDeleteAny: boolean
}

// Fil unifié de /fil : posts, annonces et événements déjà fusionnés/triés
// (voir src/lib/feed/merge-feed-items.ts) rendus dans une seule colonne.
// « Voir plus » ne charge que des posts supplémentaires, ajoutés en fin de
// liste (approche volontairement simple, voir le plan produit).
export function UnifiedFeed({
  initialItems,
  initialPostCount,
  pageSize,
  currentUserId,
  canDeleteAny,
}: UnifiedFeedProps) {
  const [items, setItems] = useState(initialItems)
  const [postsLoaded, setPostsLoaded] = useState(initialPostCount)
  const [hasMore, setHasMore] = useState(initialPostCount === pageSize)
  const [isPending, startTransition] = useTransition()

  // Même technique que PostList : `initialItems` change à chaque rendu du
  // composant serveur parent (après une mutation, voir `refresh()` dans
  // src/app/actions/feed.ts) — on fusionne les nouveaux éléments en tête
  // plutôt que de remplacer, pour ne pas perdre les pages chargées via
  // « Voir plus ». Ajustement fait PENDANT le rendu (pas dans un effet).
  const [prevInitialItems, setPrevInitialItems] = useState(initialItems)
  if (initialItems !== prevInitialItems) {
    setPrevInitialItems(initialItems)
    const existingKeys = new Set(items.map(feedItemKey))
    const newHeadItems = initialItems.filter((item) => !existingKeys.has(feedItemKey(item)))
    if (newHeadItems.length > 0) {
      setItems([...newHeadItems, ...items])
    }
  }

  function handleLoadMore() {
    startTransition(async () => {
      const result = await loadMoreFeedPostsAction({ scope: { type: "general" }, offset: postsLoaded })
      const newItems: FeedItem[] = result.posts.map((post) => ({
        kind: "post",
        date: post.createdAt,
        data: post,
      }))
      setItems((prev) => [...prev, ...newItems])
      setPostsLoaded((prev) => prev + result.posts.length)
      setHasMore(result.posts.length === pageSize)
    })
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <NewspaperIcon className="size-8" />
          <p className="text-sm">
            Aucune publication pour le moment. Soyez la première personne à partager quelque
            chose !
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => {
        if (item.kind === "post") {
          return (
            <PostCard
              key={feedItemKey(item)}
              post={item.data}
              currentUserId={currentUserId}
              canDeleteAny={canDeleteAny}
            />
          )
        }
        if (item.kind === "announcement") {
          return <AnnouncementFeedCard key={feedItemKey(item)} announcement={item.data} />
        }
        return <EventFeedCard key={feedItemKey(item)} event={item.data} />
      })}
      {hasMore && (
        <Button variant="outline" onClick={handleLoadMore} disabled={isPending} className="mx-auto">
          Voir plus
        </Button>
      )}
    </div>
  )
}
