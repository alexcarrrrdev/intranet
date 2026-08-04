"use server"

import { headers } from "next/headers"
import { refresh } from "next/cache"

import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/auth/permissions"
import {
  addComment,
  createKudosPost,
  createMessagePost,
  createPollPost,
  deleteComment,
  deletePost,
  getCommentOwnership,
  getPostOwnership,
  isGroupMember,
  listFeedPosts,
  listPostComments,
  optionBelongsToPost,
  removeReaction,
  setReaction,
  votePoll,
  type FeedComment,
  type FeedPost,
} from "@/lib/feed/posts"
import {
  addCommentSchema,
  createKudosPostSchema,
  createMessagePostSchema,
  createPollPostSchema,
  deleteCommentSchema,
  deletePostSchema,
  setReactionSchema,
  votePollSchema,
} from "@/lib/feed/schemas"

type ActionResult = { error?: string }

async function requireSession() {
  return auth.api.getSession({ headers: await headers() })
}

// Poster (message/bon coup/sondage) dans un groupe requiert d'en être
// membre — vérifié ici, jamais déduit du fait que l'UI du groupe propose ou
// non le composeur.
async function assertCanPostIn(groupId: string | null, userId: string): Promise<string | null> {
  if (!groupId) return null
  if (!(await isGroupMember(groupId, userId))) {
    return "Vous devez être membre de ce groupe pour y publier."
  }
  return null
}

export async function createMessagePostAction(
  values: unknown,
): Promise<ActionResult> {
  const session = await requireSession()
  if (!session) return { error: "Vous devez être connecté." }

  const parsed = createMessagePostSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Message invalide." }
  }

  const groupError = await assertCanPostIn(parsed.data.groupId ?? null, session.user.id)
  if (groupError) return { error: groupError }

  try {
    await createMessagePost({
      groupId: parsed.data.groupId ?? null,
      authorId: session.user.id,
      body: parsed.data.body,
    })
  } catch {
    return { error: "Une erreur est survenue lors de la publication." }
  }

  refresh()
  return {}
}

export async function createKudosPostAction(values: unknown): Promise<ActionResult> {
  const session = await requireSession()
  if (!session) return { error: "Vous devez être connecté." }

  const parsed = createKudosPostSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Bon coup invalide." }
  }

  const groupError = await assertCanPostIn(parsed.data.groupId ?? null, session.user.id)
  if (groupError) return { error: groupError }

  try {
    await createKudosPost({
      groupId: parsed.data.groupId ?? null,
      authorId: session.user.id,
      body: parsed.data.body,
      kudosRecipientId: parsed.data.kudosRecipientId,
    })
  } catch {
    return { error: "Une erreur est survenue lors de la publication." }
  }

  refresh()
  return {}
}

export async function createPollPostAction(values: unknown): Promise<ActionResult> {
  const session = await requireSession()
  if (!session) return { error: "Vous devez être connecté." }

  const parsed = createPollPostSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Sondage invalide." }
  }

  const groupError = await assertCanPostIn(parsed.data.groupId ?? null, session.user.id)
  if (groupError) return { error: groupError }

  try {
    await createPollPost({
      groupId: parsed.data.groupId ?? null,
      authorId: session.user.id,
      body: parsed.data.body,
      options: parsed.data.options,
    })
  } catch {
    return { error: "Une erreur est survenue lors de la publication." }
  }

  refresh()
  return {}
}

// Suppression d'un post : son auteur peut toujours supprimer le sien, sans
// permission particulière ; sinon il faut `post:delete-any` (modération).
export async function deletePostAction(values: unknown): Promise<ActionResult> {
  const session = await requireSession()
  if (!session) return { error: "Vous devez être connecté." }

  const parsed = deletePostSchema.safeParse(values)
  if (!parsed.success) return { error: "Publication invalide." }

  const ownership = await getPostOwnership(parsed.data.postId)
  if (!ownership) return { error: "Cette publication n'existe plus." }

  const isAuthor = ownership.authorId === session.user.id
  if (!isAuthor && !(await hasPermission(session.user, "post", "delete-any"))) {
    return { error: "Vous n'avez pas la permission de supprimer cette publication." }
  }

  try {
    await deletePost(parsed.data.postId)
  } catch {
    return { error: "Une erreur est survenue lors de la suppression." }
  }

  refresh()
  return {}
}

export async function deleteCommentAction(values: unknown): Promise<ActionResult> {
  const session = await requireSession()
  if (!session) return { error: "Vous devez être connecté." }

  const parsed = deleteCommentSchema.safeParse(values)
  if (!parsed.success) return { error: "Commentaire invalide." }

  const ownership = await getCommentOwnership(parsed.data.commentId)
  if (!ownership) return { error: "Ce commentaire n'existe plus." }

  const isAuthor = ownership.authorId === session.user.id
  if (!isAuthor && !(await hasPermission(session.user, "post", "delete-any"))) {
    return { error: "Vous n'avez pas la permission de supprimer ce commentaire." }
  }

  try {
    await deleteComment(parsed.data.commentId)
  } catch {
    return { error: "Une erreur est survenue lors de la suppression." }
  }

  refresh()
  return {}
}

export async function addCommentAction(
  values: unknown,
): Promise<ActionResult & { comment?: FeedComment }> {
  const session = await requireSession()
  if (!session) return { error: "Vous devez être connecté." }

  const parsed = addCommentSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Commentaire invalide." }
  }

  const ownership = await getPostOwnership(parsed.data.postId)
  if (!ownership) return { error: "Cette publication n'existe plus." }

  let comment: FeedComment
  try {
    comment = await addComment({
      postId: parsed.data.postId,
      authorId: session.user.id,
      body: parsed.data.body,
    })
  } catch {
    return { error: "Une erreur est survenue lors de l'ajout du commentaire." }
  }

  refresh()
  return { comment }
}

// Réagir : cliquer sur le même emoji que sa réaction actuelle la retire,
// cliquer sur un autre la remplace — logique du bouton (toggle) laissée au
// composant client, cette action ne fait qu'exécuter le choix reçu.
export async function setReactionAction(values: unknown): Promise<ActionResult> {
  const session = await requireSession()
  if (!session) return { error: "Vous devez être connecté." }

  const parsed = setReactionSchema.safeParse(values)
  if (!parsed.success) return { error: "Réaction invalide." }

  const ownership = await getPostOwnership(parsed.data.postId)
  if (!ownership) return { error: "Cette publication n'existe plus." }

  try {
    await setReaction({ postId: parsed.data.postId, userId: session.user.id, emoji: parsed.data.emoji })
  } catch {
    return { error: "Une erreur est survenue." }
  }

  refresh()
  return {}
}

export async function removeReactionAction(values: unknown): Promise<ActionResult> {
  const session = await requireSession()
  if (!session) return { error: "Vous devez être connecté." }

  const parsed = deletePostSchema.safeParse(values)
  if (!parsed.success) return { error: "Publication invalide." }

  try {
    await removeReaction({ postId: parsed.data.postId, userId: session.user.id })
  } catch {
    return { error: "Une erreur est survenue." }
  }

  refresh()
  return {}
}

export async function votePollAction(values: unknown): Promise<ActionResult> {
  const session = await requireSession()
  if (!session) return { error: "Vous devez être connecté." }

  const parsed = votePollSchema.safeParse(values)
  if (!parsed.success) return { error: "Vote invalide." }

  const ownership = await getPostOwnership(parsed.data.postId)
  if (!ownership) return { error: "Ce sondage n'existe plus." }

  if (!(await optionBelongsToPost(parsed.data.optionId, parsed.data.postId))) {
    return { error: "Cette option n'appartient pas à ce sondage." }
  }

  try {
    await votePoll({ postId: parsed.data.postId, userId: session.user.id, optionId: parsed.data.optionId })
  } catch {
    return { error: "Une erreur est survenue lors du vote." }
  }

  refresh()
  return {}
}

const FEED_PAGE_SIZE = 30

// Chargement d'une page supplémentaire du fil (bouton « Voir plus », voir
// src/components/feed/post-list.tsx) — lecture seule, pas de mutation, donc
// pas de `refresh()` ici.
export async function loadMoreFeedPostsAction(params: {
  groupId: string | null
  offset: number
}): Promise<{ posts: FeedPost[]; error?: string }> {
  const session = await requireSession()
  if (!session) return { posts: [], error: "Vous devez être connecté." }

  const posts = await listFeedPosts({
    groupId: params.groupId,
    currentUserId: session.user.id,
    limit: FEED_PAGE_SIZE,
    offset: params.offset,
  })

  return { posts }
}

// Chargement des commentaires d'un post, à la demande (dépliage) — voir
// src/components/feed/post-card.tsx.
export async function loadPostCommentsAction(
  postId: string,
): Promise<{ comments: FeedComment[]; error?: string }> {
  const session = await requireSession()
  if (!session) return { comments: [], error: "Vous devez être connecté." }

  const comments = await listPostComments(postId)
  return { comments }
}
