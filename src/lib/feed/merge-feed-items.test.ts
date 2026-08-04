import { describe, expect, it } from "vitest"

import type { AnnouncementListItem } from "@/lib/announcements/announcements"
import type { EventListItem } from "@/lib/events/events"
import { feedItemKey, mergeFeedItems } from "@/lib/feed/merge-feed-items"
import type { FeedPost } from "@/lib/feed/posts"

function makePost(overrides: Partial<FeedPost> = {}): FeedPost {
  return {
    id: "post-1",
    type: "message",
    body: "Bonjour",
    createdAt: new Date("2026-08-01T10:00:00"),
    author: { id: "u1", name: "Alex", image: null },
    kudosRecipient: null,
    commentCount: 0,
    reactions: [],
    myReaction: null,
    pollOptions: [],
    pollTotalVotes: 0,
    myPollOptionId: null,
    group: null,
    ...overrides,
  }
}

function makeAnnouncement(overrides: Partial<AnnouncementListItem> = {}): AnnouncementListItem {
  return {
    id: "ann-1",
    title: "Titre",
    body: "Corps",
    pinned: false,
    createdAt: new Date("2026-08-01T09:00:00"),
    authorName: "Alex",
    isRead: false,
    readCount: null,
    totalUsers: null,
    ...overrides,
  }
}

function makeEvent(overrides: Partial<EventListItem> = {}): EventListItem {
  return {
    id: "evt-1",
    title: "Réunion",
    description: null,
    location: null,
    startsAt: new Date("2026-09-01T14:00:00"),
    endsAt: null,
    allDay: false,
    createdAt: new Date("2026-08-01T08:00:00"),
    ...overrides,
  }
}

describe("mergeFeedItems", () => {
  it("trie tous les items par date décroissante", () => {
    const posts = [makePost({ id: "p-old", createdAt: new Date("2026-08-01T08:00:00") })]
    const announcements = [
      makeAnnouncement({ id: "a-new", createdAt: new Date("2026-08-03T08:00:00") }),
    ]
    const events = [makeEvent({ id: "e-mid", createdAt: new Date("2026-08-02T08:00:00") })]

    const result = mergeFeedItems({ posts, announcements, events })

    expect(result.map(feedItemKey)).toEqual(["announcement:a-new", "event:e-mid", "post:p-old"])
  })

  it("place une annonce épinglée en tête même si elle est plus ancienne que tout le reste", () => {
    const posts = [makePost({ id: "p-recent", createdAt: new Date("2026-08-04T10:00:00") })]
    const announcements = [
      makeAnnouncement({
        id: "a-pinned-old",
        pinned: true,
        createdAt: new Date("2026-01-01T00:00:00"),
      }),
    ]
    const events = [makeEvent({ id: "e-recent", createdAt: new Date("2026-08-04T09:00:00") })]

    const result = mergeFeedItems({ posts, announcements, events })

    expect(feedItemKey(result[0])).toBe("announcement:a-pinned-old")
  })

  it("trie correctement des posts, annonces et événements mélangés", () => {
    const posts = [
      makePost({ id: "p1", createdAt: new Date("2026-08-04T12:00:00") }),
      makePost({ id: "p2", createdAt: new Date("2026-08-02T12:00:00") }),
    ]
    const announcements = [
      makeAnnouncement({ id: "a1", createdAt: new Date("2026-08-03T12:00:00") }),
    ]
    const events = [makeEvent({ id: "e1", createdAt: new Date("2026-08-01T12:00:00") })]

    const result = mergeFeedItems({ posts, announcements, events })

    expect(result.map(feedItemKey)).toEqual(["post:p1", "announcement:a1", "post:p2", "event:e1"])
  })
})
