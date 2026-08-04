import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { PostCard } from "@/components/feed/post-card"
import type { FeedPost } from "@/lib/feed/posts"

vi.mock("@/app/actions/feed", () => ({
  addCommentAction: vi.fn(),
  deleteCommentAction: vi.fn(),
  deletePostAction: vi.fn(),
  loadPostCommentsAction: vi.fn().mockResolvedValue({ comments: [] }),
  removeReactionAction: vi.fn(),
  setReactionAction: vi.fn(),
  votePollAction: vi.fn(),
}))

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const basePost: FeedPost = {
  id: "post-1",
  type: "message",
  body: "Bonjour à tous !",
  createdAt: new Date("2026-08-04T10:00:00"),
  author: { id: "author-1", name: "Alex Caron", image: null },
  kudosRecipient: null,
  commentCount: 0,
  reactions: [],
  myReaction: null,
  pollOptions: [],
  pollTotalVotes: 0,
  myPollOptionId: null,
  group: null,
}

describe("PostCard", () => {
  it("affiche un message simple", () => {
    render(<PostCard post={basePost} currentUserId="author-1" canDeleteAny={false} />)
    expect(screen.getByText("Bonjour à tous !")).toBeInTheDocument()
    expect(screen.getByText("Alex Caron")).toBeInTheDocument()
  })

  it("affiche le rendu distinct d'un bon coup", () => {
    const kudosPost: FeedPost = {
      ...basePost,
      type: "kudos",
      kudosRecipient: { id: "u2", name: "Sam Tremblay", image: null },
    }
    render(<PostCard post={kudosPost} currentUserId="author-1" canDeleteAny={false} />)
    expect(screen.getByText("félicite")).toBeInTheDocument()
    expect(screen.getByText("Sam Tremblay")).toBeInTheDocument()
  })

  it("affiche les boutons de vote d'un sondage tant que l'utilisateur n'a pas voté", () => {
    const pollPost: FeedPost = {
      ...basePost,
      type: "poll",
      pollOptions: [
        { id: "opt-1", label: "Pizza", position: 0, voteCount: 2 },
        { id: "opt-2", label: "Sushi", position: 1, voteCount: 1 },
      ],
      pollTotalVotes: 3,
    }
    render(<PostCard post={pollPost} currentUserId="author-1" canDeleteAny={false} />)
    expect(screen.getByRole("button", { name: "Pizza" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sushi" })).toBeInTheDocument()
  })

  it("n'affiche pas le menu de suppression pour un utilisateur sans droit", () => {
    render(<PostCard post={basePost} currentUserId="quelqu-un-d-autre" canDeleteAny={false} />)
    expect(screen.queryByRole("button", { name: /more/i })).not.toBeInTheDocument()
  })
})
