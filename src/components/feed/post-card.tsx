"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import {
  AwardIcon,
  CheckCircle2Icon,
  CircleIcon,
  MessageCircleIcon,
  MoreHorizontalIcon,
  SendIcon,
  SmilePlusIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  addCommentAction,
  deleteCommentAction,
  deletePostAction,
  loadPostCommentsAction,
  removeReactionAction,
  setReactionAction,
  votePollAction,
} from "@/app/actions/feed"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { formatRelativeTime } from "@/lib/dates"
import { REACTION_EMOJIS } from "@/lib/feed/schemas"
import type { FeedComment, FeedPost } from "@/lib/feed/posts"
import { cn } from "@/lib/utils"

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function AuthorAvatar({ name, image }: { name: string; image: string | null }) {
  return (
    <Avatar>
      {image ? <AvatarImage src={image} alt={name} /> : null}
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  )
}

type PostCardProps = {
  post: FeedPost
  currentUserId: string
  canDeleteAny: boolean
}

// Carte d'une publication du fil (message, bon coup ou sondage — même
// composant, rendu adapté selon `post.type`) : réactions, commentaires
// repliés, suppression. Réutilisé tel quel par /fil et /groupes/[id].
export function PostCard({ post, currentUserId, canDeleteAny }: PostCardProps) {
  const [deleted, setDeleted] = useState(false)
  const [reactions, setReactions] = useState(post.reactions)
  const [myReaction, setMyReaction] = useState(post.myReaction)
  const [pollOptions, setPollOptions] = useState(post.pollOptions)
  const [myPollOptionId, setMyPollOptionId] = useState(post.myPollOptionId)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [comments, setComments] = useState<FeedComment[] | null>(null)
  const [commentCount, setCommentCount] = useState(post.commentCount)
  const [commentBody, setCommentBody] = useState("")
  const [isPending, startTransition] = useTransition()

  if (deleted) return null

  const canDelete = post.author.id === currentUserId || canDeleteAny
  const pollTotalVotes = pollOptions.reduce((sum, option) => sum + option.voteCount, 0)

  function handleDelete() {
    startTransition(async () => {
      const result = await deletePostAction({ postId: post.id })
      if (result.error) {
        toast.error(result.error)
        return
      }
      setDeleted(true)
    })
  }

  function handleReaction(emoji: string) {
    const next = emoji === myReaction ? null : emoji
    // Optimiste : on ajuste les compteurs localement, puis on synchronise.
    setReactions((prev) => {
      const withoutMine = prev
        .map((r) => (r.emoji === myReaction ? { ...r, count: r.count - 1 } : r))
        .filter((r) => r.count > 0)
      if (!next) return withoutMine
      const existing = withoutMine.find((r) => r.emoji === next)
      if (existing) {
        return withoutMine.map((r) => (r.emoji === next ? { ...r, count: r.count + 1 } : r))
      }
      return [...withoutMine, { emoji: next, count: 1 }]
    })
    setMyReaction(next)

    startTransition(async () => {
      const result = next
        ? await setReactionAction({ postId: post.id, emoji: next })
        : await removeReactionAction({ postId: post.id })
      if (result.error) toast.error(result.error)
    })
  }

  function handleVote(optionId: string) {
    const previous = myPollOptionId
    setMyPollOptionId(optionId)
    setPollOptions((prev) =>
      prev.map((option) => {
        if (option.id === optionId) return { ...option, voteCount: option.voteCount + 1 }
        if (option.id === previous) return { ...option, voteCount: Math.max(0, option.voteCount - 1) }
        return option
      }),
    )
    startTransition(async () => {
      const result = await votePollAction({ postId: post.id, optionId })
      if (result.error) toast.error(result.error)
    })
  }

  async function handleOpenComments() {
    setCommentsOpen((open) => !open)
    if (!comments) {
      const result = await loadPostCommentsAction(post.id)
      setComments(result.comments)
    }
  }

  function handleAddComment() {
    const body = commentBody.trim()
    if (!body) return
    startTransition(async () => {
      const result = await addCommentAction({ postId: post.id, body })
      if (result.error) {
        toast.error(result.error)
        return
      }
      if (result.comment) {
        setComments((prev) => [...(prev ?? []), result.comment!])
        setCommentCount((count) => count + 1)
        setCommentBody("")
      }
    })
  }

  function handleDeleteComment(commentId: string) {
    startTransition(async () => {
      const result = await deleteCommentAction({ commentId })
      if (result.error) {
        toast.error(result.error)
        return
      }
      setComments((prev) => (prev ?? []).filter((c) => c.id !== commentId))
      setCommentCount((count) => Math.max(0, count - 1))
    })
  }

  return (
    <Card className={cn(post.type === "kudos" && "border-primary/25 bg-primary/[0.04]")}>
      <CardContent className="flex flex-col gap-3 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <AuthorAvatar name={post.author.name} image={post.author.image} />
            <div>
              {post.type === "kudos" && post.kudosRecipient ? (
                <p className="flex flex-wrap items-center gap-1.5 text-sm">
                  <span className="font-medium">{post.author.name}</span>
                  <span className="text-muted-foreground">félicite</span>
                  <span className="font-medium">{post.kudosRecipient.name}</span>
                </p>
              ) : (
                <p className="text-sm font-medium">{post.author.name}</p>
              )}
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                {formatRelativeTime(post.createdAt)}
                {post.group && (
                  <>
                    <span aria-hidden>·</span>
                    <Link href={`/groupes/${post.group.id}`} className="hover:text-primary hover:underline">
                      dans {post.group.name}
                    </Link>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {post.type === "kudos" && (
              <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                <AwardIcon className="size-3.5" />
                Bon coup
              </span>
            )}
          {canDelete && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon" className="size-8">
                    <MoreHorizontalIcon className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem variant="destructive" onClick={handleDelete}>
                  Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          </div>
        </div>

        <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{post.body}</p>

        {post.type === "poll" && (
          <div className="flex flex-col gap-2">
            {pollOptions.map((option) => {
              const percentage =
                pollTotalVotes === 0 ? 0 : Math.round((option.voteCount / pollTotalVotes) * 100)
              const isMine = option.id === myPollOptionId
              if (myPollOptionId) {
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleVote(option.id)}
                    className={cn(
                      "group relative overflow-hidden rounded-lg border text-left transition-colors",
                      isMine ? "border-primary/50" : "hover:border-primary/30",
                    )}
                  >
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 bg-primary/10 transition-[width] duration-500",
                        isMine && "bg-primary/20",
                      )}
                      style={{ width: `${percentage}%` }}
                    />
                    <div className="relative flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                      <span className="flex items-center gap-2">
                        {isMine && <CheckCircle2Icon className="size-4 shrink-0 text-primary" />}
                        <span className={cn(isMine && "font-medium")}>{option.label}</span>
                      </span>
                      <span className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
                        {percentage} %
                      </span>
                    </div>
                  </button>
                )
              }
              return (
                <Button
                  key={option.id}
                  type="button"
                  variant="outline"
                  className="group justify-start gap-2 hover:border-primary/40 hover:bg-primary/5"
                  onClick={() => handleVote(option.id)}
                >
                  <CircleIcon className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
                  {option.label}
                </Button>
              )
            })}
            <p className="text-xs text-muted-foreground">
              {pollTotalVotes} vote{pollTotalVotes > 1 ? "s" : ""}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5 border-t pt-2.5">
          {reactions.map((reaction) => (
            <button
              key={reaction.emoji}
              type="button"
              onClick={() => handleReaction(reaction.emoji)}
              className={cn(
                "flex h-7 items-center gap-1 rounded-full border px-2.5 text-sm transition-colors",
                myReaction === reaction.emoji
                  ? "border-primary/50 bg-primary/10"
                  : "border-border bg-muted/40 hover:bg-muted",
              )}
            >
              <span className="text-[15px] leading-none">{reaction.emoji}</span>
              <span className="text-xs font-medium text-muted-foreground tabular-nums">
                {reaction.count}
              </span>
            </button>
          ))}

          <Popover>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="size-7 rounded-full p-0 text-muted-foreground"
                  aria-label="Réagir"
                >
                  <SmilePlusIcon className="size-4" />
                </Button>
              }
            />
            <PopoverContent align="start" className="w-auto p-1.5">
              <div className="flex gap-0.5">
                {REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleReaction(emoji)}
                    className={cn(
                      "flex size-9 items-center justify-center rounded-md text-lg transition-transform hover:scale-125 hover:bg-muted",
                      myReaction === emoji && "bg-primary/10",
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto gap-1.5 text-muted-foreground"
            onClick={handleOpenComments}
          >
            <MessageCircleIcon className="size-4" />
            {commentCount > 0
              ? `${commentCount} commentaire${commentCount > 1 ? "s" : ""}`
              : "Commenter"}
          </Button>
        </div>

        {commentsOpen && (
          <div className="flex flex-col gap-3 border-t pt-3">
            {(comments ?? []).map((comment) => (
              <div key={comment.id} className="flex items-start gap-2">
                <AuthorAvatar name={comment.author.name} image={comment.author.image} />
                <div className="min-w-0 flex-1 rounded-lg bg-muted px-3 py-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xs font-medium">{comment.author.name}</p>
                    <span className="text-[11px] text-muted-foreground">
                      {formatRelativeTime(comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
                </div>
                {(comment.author.id === currentUserId || canDeleteAny) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground"
                    onClick={() => handleDeleteComment(comment.id)}
                  >
                    <MoreHorizontalIcon className="size-3.5" />
                  </Button>
                )}
              </div>
            ))}

            <div className="flex items-center gap-2">
              <Textarea
                value={commentBody}
                onChange={(event) => setCommentBody(event.target.value)}
                placeholder="Ajouter un commentaire…"
                className="min-h-9 py-1.5"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    handleAddComment()
                  }
                }}
              />
              <Button
                type="button"
                size="icon"
                className="shrink-0"
                disabled={!commentBody.trim() || isPending}
                onClick={handleAddComment}
              >
                <SendIcon className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
