/**
 * Logique du fil (/fil et /groupes/[id] — mêmes composants/actions, voir
 * src/components/feed et src/app/actions/feed.ts). `groupId` NULL partout
 * ci-dessous signifie « fil général ».
 */
import { randomUUID } from "node:crypto"
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm"

import { db } from "@/db"
import {
  groupMember,
  intranetGroup,
  pollOption,
  pollVote,
  post,
  postComment,
  postReaction,
  user,
} from "@/db/schema"
import type { ReactionEmoji } from "@/lib/feed/schemas"

export type FeedAuthor = {
  id: string
  name: string
  image: string | null
}

export type FeedPollOption = {
  id: string
  label: string
  position: number
  voteCount: number
}

export type FeedGroupRef = { id: string; name: string }

export type FeedPost = {
  id: string
  type: "message" | "kudos" | "poll"
  body: string
  createdAt: Date
  author: FeedAuthor
  kudosRecipient: FeedAuthor | null
  commentCount: number
  reactions: { emoji: string; count: number }[]
  myReaction: string | null
  pollOptions: FeedPollOption[]
  pollTotalVotes: number
  myPollOptionId: string | null
  // Groupe d'origine du post, uniquement renseigné dans le fil général
  // (`groupId: null` passé à listFeedPosts) pour un post provenant d'un
  // groupe dont l'utilisateur est membre — voir listFeedPosts ci-dessous.
  // Toujours `null` en mode fil de groupe (`groupId` fourni).
  group: FeedGroupRef | null
}

const NO_AUTHOR: FeedAuthor = { id: "", name: "Utilisateur inconnu", image: null }

/**
 * Charge une page du fil, triée du plus récent au plus ancien, avec toutes
 * les données d'affichage agrégées en quelques requêtes seulement (pas une
 * par post) : comptes de réactions/commentaires groupés par post, options +
 * comptes de vote des sondages, et la réaction/le vote propres à
 * `currentUserId`.
 *
 * Deux modes :
 * - `groupId` fourni : fil d'un groupe précis (/groupes/[id]), inchangé —
 *   `group` vaut toujours `null` sur les posts retournés.
 * - `groupId: null` : fil général UNIFIÉ (/fil) — retourne les posts sans
 *   groupe ET les posts des groupes dont `currentUserId` est membre (un seul
 *   `inArray` sur les appartenances, pas de requête par post), avec `group`
 *   renseigné pour ces derniers afin que l'UI puisse afficher « dans
 *   {groupe} ».
 */
export async function listFeedPosts(params: {
  groupId: string | null
  currentUserId: string
  limit: number
  offset: number
}): Promise<FeedPost[]> {
  const { groupId, currentUserId, limit, offset } = params

  let whereClause = groupId ? eq(post.groupId, groupId) : isNull(post.groupId)

  if (!groupId) {
    const memberships = await db
      .select({ groupId: groupMember.groupId })
      .from(groupMember)
      .where(eq(groupMember.userId, currentUserId))
    const memberGroupIds = memberships.map((row) => row.groupId)
    if (memberGroupIds.length > 0) {
      whereClause = or(isNull(post.groupId), inArray(post.groupId, memberGroupIds))!
    }
  }

  const rows = await db
    .select({
      id: post.id,
      type: post.type,
      body: post.body,
      createdAt: post.createdAt,
      authorId: post.authorId,
      authorName: user.name,
      authorImage: user.image,
      kudosRecipientId: post.kudosRecipientId,
      groupId: post.groupId,
      groupName: intranetGroup.name,
    })
    .from(post)
    .innerJoin(user, eq(post.authorId, user.id))
    .leftJoin(intranetGroup, eq(post.groupId, intranetGroup.id))
    .where(whereClause)
    .orderBy(desc(post.createdAt))
    .limit(limit)
    .offset(offset)

  if (rows.length === 0) return []

  const postIds = rows.map((row) => row.id)
  const kudosRecipientIds = rows
    .map((row) => row.kudosRecipientId)
    .filter((id): id is string => id != null)

  const [recipients, commentCounts, reactionRows, myReactions, pollOptionRows, myVotes] =
    await Promise.all([
      kudosRecipientIds.length
        ? db
            .select({ id: user.id, name: user.name, image: user.image })
            .from(user)
            .where(inArray(user.id, kudosRecipientIds))
        : Promise.resolve([]),
      db
        .select({ postId: postComment.postId })
        .from(postComment)
        .where(inArray(postComment.postId, postIds)),
      db
        .select({ postId: postReaction.postId, emoji: postReaction.emoji })
        .from(postReaction)
        .where(inArray(postReaction.postId, postIds)),
      db
        .select({ postId: postReaction.postId, emoji: postReaction.emoji })
        .from(postReaction)
        .where(
          and(inArray(postReaction.postId, postIds), eq(postReaction.userId, currentUserId)),
        ),
      db
        .select({
          id: pollOption.id,
          postId: pollOption.postId,
          label: pollOption.label,
          position: pollOption.position,
        })
        .from(pollOption)
        .where(inArray(pollOption.postId, postIds))
        .orderBy(pollOption.position),
      db
        .select({ postId: pollVote.postId, optionId: pollVote.optionId })
        .from(pollVote)
        .where(and(inArray(pollVote.postId, postIds), eq(pollVote.userId, currentUserId))),
    ])

  // Un seul aller-retour supplémentaire pour compter les votes de TOUTES les
  // options de la page, groupées par option — évite une requête par sondage.
  const optionIds = pollOptionRows.map((row) => row.id)
  const voteCountRows = optionIds.length
    ? await db
        .select({ optionId: pollVote.optionId })
        .from(pollVote)
        .where(inArray(pollVote.optionId, optionIds))
    : []

  const recipientById = new Map(recipients.map((row) => [row.id, row]))
  const commentCountByPost = countBy(commentCounts, (row) => row.postId)
  const myReactionByPost = new Map(myReactions.map((row) => [row.postId, row.emoji]))
  const myVoteByPost = new Map(myVotes.map((row) => [row.postId, row.optionId]))
  const voteCountByOption = countBy(voteCountRows, (row) => row.optionId)

  const reactionCountsByPost = new Map<string, Map<string, number>>()
  for (const row of reactionRows) {
    const byEmoji = reactionCountsByPost.get(row.postId) ?? new Map<string, number>()
    byEmoji.set(row.emoji, (byEmoji.get(row.emoji) ?? 0) + 1)
    reactionCountsByPost.set(row.postId, byEmoji)
  }

  const pollOptionsByPost = new Map<string, FeedPollOption[]>()
  for (const row of pollOptionRows) {
    const list = pollOptionsByPost.get(row.postId) ?? []
    list.push({
      id: row.id,
      label: row.label,
      position: row.position,
      voteCount: voteCountByOption.get(row.id) ?? 0,
    })
    pollOptionsByPost.set(row.postId, list)
  }

  return rows.map((row) => {
    const options = pollOptionsByPost.get(row.id) ?? []
    return {
      id: row.id,
      type: row.type as FeedPost["type"],
      body: row.body,
      createdAt: row.createdAt,
      author: { id: row.authorId, name: row.authorName, image: row.authorImage },
      kudosRecipient: row.kudosRecipientId
        ? (recipientById.get(row.kudosRecipientId) ?? NO_AUTHOR)
        : null,
      commentCount: commentCountByPost.get(row.id) ?? 0,
      reactions: Array.from(reactionCountsByPost.get(row.id) ?? new Map()).map(
        ([emoji, count]) => ({ emoji, count }),
      ),
      myReaction: myReactionByPost.get(row.id) ?? null,
      pollOptions: options,
      pollTotalVotes: options.reduce((sum, option) => sum + option.voteCount, 0),
      myPollOptionId: myVoteByPost.get(row.id) ?? null,
      group: !groupId && row.groupId && row.groupName ? { id: row.groupId, name: row.groupName } : null,
    }
  })
}

function countBy<T>(rows: T[], key: (row: T) => string): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows) {
    const k = key(row)
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return map
}

export type FeedComment = {
  id: string
  body: string
  createdAt: Date
  author: FeedAuthor
}

/** Charge les commentaires d'un post, chargés à la demande (dépliage). */
export async function listPostComments(postId: string): Promise<FeedComment[]> {
  const rows = await db
    .select({
      id: postComment.id,
      body: postComment.body,
      createdAt: postComment.createdAt,
      authorId: postComment.authorId,
      authorName: user.name,
      authorImage: user.image,
    })
    .from(postComment)
    .innerJoin(user, eq(postComment.authorId, user.id))
    .where(eq(postComment.postId, postId))
    .orderBy(postComment.createdAt)

  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.createdAt,
    author: { id: row.authorId, name: row.authorName, image: row.authorImage },
  }))
}

/** Vérifie qu'un utilisateur est membre du groupe donné (pour poster). */
export async function isGroupMember(groupId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ groupId: groupMember.groupId })
    .from(groupMember)
    .where(and(eq(groupMember.groupId, groupId), eq(groupMember.userId, userId)))
    .limit(1)
  return row != null
}

export async function createMessagePost(params: {
  groupId: string | null
  authorId: string
  body: string
}): Promise<void> {
  await db.insert(post).values({
    id: randomUUID(),
    authorId: params.authorId,
    groupId: params.groupId,
    type: "message",
    body: params.body,
  })
}

export async function createKudosPost(params: {
  groupId: string | null
  authorId: string
  body: string
  kudosRecipientId: string
}): Promise<void> {
  await db.insert(post).values({
    id: randomUUID(),
    authorId: params.authorId,
    groupId: params.groupId,
    type: "kudos",
    body: params.body,
    kudosRecipientId: params.kudosRecipientId,
  })
}

export async function createPollPost(params: {
  groupId: string | null
  authorId: string
  body: string
  options: string[]
}): Promise<void> {
  const postId = randomUUID()
  await db.transaction(async (tx) => {
    await tx.insert(post).values({
      id: postId,
      authorId: params.authorId,
      groupId: params.groupId,
      type: "poll",
      body: params.body,
    })
    await tx.insert(pollOption).values(
      params.options.map((label, index) => ({
        id: randomUUID(),
        postId,
        label,
        position: index,
      })),
    )
  })
}

export type PostOwnership = { authorId: string; groupId: string | null } | null

export async function getPostOwnership(postId: string): Promise<PostOwnership> {
  const [row] = await db
    .select({ authorId: post.authorId, groupId: post.groupId })
    .from(post)
    .where(eq(post.id, postId))
    .limit(1)
  return row ?? null
}

export async function deletePost(postId: string): Promise<void> {
  await db.delete(post).where(eq(post.id, postId))
}

export type CommentOwnership = { authorId: string; postId: string } | null

export async function getCommentOwnership(commentId: string): Promise<CommentOwnership> {
  const [row] = await db
    .select({ authorId: postComment.authorId, postId: postComment.postId })
    .from(postComment)
    .where(eq(postComment.id, commentId))
    .limit(1)
  return row ?? null
}

export async function deleteComment(commentId: string): Promise<void> {
  await db.delete(postComment).where(eq(postComment.id, commentId))
}

export async function addComment(params: {
  postId: string
  authorId: string
  body: string
}): Promise<FeedComment> {
  const id = randomUUID()
  await db.insert(postComment).values({
    id,
    postId: params.postId,
    authorId: params.authorId,
    body: params.body,
  })
  const [row] = await db
    .select({ name: user.name, image: user.image })
    .from(user)
    .where(eq(user.id, params.authorId))
    .limit(1)
  return {
    id,
    body: params.body,
    createdAt: new Date(),
    author: { id: params.authorId, name: row?.name ?? "Utilisateur", image: row?.image ?? null },
  }
}

/** Réaction : une seule par (post, utilisateur) — remplace la précédente. */
export async function setReaction(params: {
  postId: string
  userId: string
  emoji: ReactionEmoji
}): Promise<void> {
  await db
    .insert(postReaction)
    .values({ postId: params.postId, userId: params.userId, emoji: params.emoji })
    .onConflictDoUpdate({
      target: [postReaction.postId, postReaction.userId],
      set: { emoji: params.emoji },
    })
}

export async function removeReaction(params: { postId: string; userId: string }): Promise<void> {
  await db
    .delete(postReaction)
    .where(and(eq(postReaction.postId, params.postId), eq(postReaction.userId, params.userId)))
}

/** Vote à un sondage : un seul par (post, utilisateur) — remplaçable. */
export async function votePoll(params: {
  postId: string
  userId: string
  optionId: string
}): Promise<void> {
  await db
    .insert(pollVote)
    .values({ postId: params.postId, userId: params.userId, optionId: params.optionId })
    .onConflictDoUpdate({
      target: [pollVote.postId, pollVote.userId],
      set: { optionId: params.optionId },
    })
}

/** Vérifie qu'une option de sondage appartient bien au post donné (garde-fou). */
export async function optionBelongsToPost(optionId: string, postId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: pollOption.id })
    .from(pollOption)
    .where(and(eq(pollOption.id, optionId), eq(pollOption.postId, postId)))
    .limit(1)
  return row != null
}

/**
 * Calcule le pourcentage arrondi de chaque option d'un sondage — fonction
 * pure, testée indépendamment (voir posts.test.ts). Retourne 0 % partout
 * quand il n'y a encore aucun vote plutôt qu'une division par zéro.
 */
export function computePollPercentages(
  options: { id: string; voteCount: number }[],
): Record<string, number> {
  const total = options.reduce((sum, option) => sum + option.voteCount, 0)
  const result: Record<string, number> = {}
  for (const option of options) {
    result[option.id] = total === 0 ? 0 : Math.round((option.voteCount / total) * 100)
  }
  return result
}
