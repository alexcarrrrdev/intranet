import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AnnouncementFeedCard } from "@/components/feed/announcement-feed-card"
import type { AnnouncementListItem } from "@/lib/announcements/announcements"

const markAnnouncementReadAction = vi.fn().mockResolvedValue({})

vi.mock("@/app/actions/announcements", () => ({
  markAnnouncementReadAction: (values: unknown) => markAnnouncementReadAction(values),
}))

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const baseAnnouncement: AnnouncementListItem = {
  id: "ann-1",
  title: "Fermeture du bureau",
  body: "Le bureau sera fermé vendredi.",
  pinned: false,
  createdAt: new Date("2026-08-04T10:00:00"),
  authorName: "Alex Caron",
  isRead: false,
  readCount: null,
  totalUsers: null,
}

describe("AnnouncementFeedCard", () => {
  it("affiche le titre, le corps et l'auteur", () => {
    render(<AnnouncementFeedCard announcement={baseAnnouncement} />)
    expect(screen.getByText("Fermeture du bureau")).toBeInTheDocument()
    expect(screen.getByText("Le bureau sera fermé vendredi.")).toBeInTheDocument()
    expect(screen.getByText(/Alex Caron/)).toBeInTheDocument()
  })

  it("affiche le badge Épinglée quand pinned est vrai", () => {
    render(<AnnouncementFeedCard announcement={{ ...baseAnnouncement, pinned: true }} />)
    expect(screen.getByText("Épinglée")).toBeInTheDocument()
  })

  it("n'affiche pas le badge Épinglée quand pinned est faux", () => {
    render(<AnnouncementFeedCard announcement={baseAnnouncement} />)
    expect(screen.queryByText("Épinglée")).not.toBeInTheDocument()
  })

  it("marque l'annonce comme lue après avoir cliqué sur le bouton", async () => {
    render(<AnnouncementFeedCard announcement={baseAnnouncement} />)
    const button = screen.getByRole("button", { name: "Marquer comme lue" })
    fireEvent.click(button)
    expect(await screen.findByText("Lue")).toBeInTheDocument()
    expect(markAnnouncementReadAction).toHaveBeenCalledWith({ announcementId: "ann-1" })
  })

  it("n'affiche pas le bouton quand l'annonce est déjà lue", () => {
    render(<AnnouncementFeedCard announcement={{ ...baseAnnouncement, isRead: true }} />)
    expect(screen.queryByRole("button", { name: "Marquer comme lue" })).not.toBeInTheDocument()
    expect(screen.getByText("Lue")).toBeInTheDocument()
  })
})
