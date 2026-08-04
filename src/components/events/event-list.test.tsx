import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { EventList } from "@/components/events/event-list"
import type { EventListItem } from "@/lib/events/events"

vi.mock("@/app/actions/events", () => ({
  deleteEventAction: vi.fn(),
}))

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const events: EventListItem[] = [
  {
    id: "evt-1",
    title: "5 à 7 de bienvenue",
    description: null,
    location: "Salle A",
    startsAt: new Date("2026-08-15T17:00:00"),
    endsAt: new Date("2026-08-15T19:00:00"),
    allDay: false,
  },
  {
    id: "evt-2",
    title: "Journée pédagogique",
    description: null,
    location: null,
    startsAt: new Date("2026-09-02T00:00:00"),
    endsAt: null,
    allDay: true,
  },
]

describe("EventList", () => {
  it("affiche un état vide sans événement", () => {
    render(<EventList events={[]} canManage={false} />)
    expect(screen.getByText(/aucun événement à venir/i)).toBeInTheDocument()
  })

  it("regroupe les événements par mois et affiche leurs titres", () => {
    render(<EventList events={events} canManage={false} />)
    expect(screen.getByText("5 à 7 de bienvenue")).toBeInTheDocument()
    expect(screen.getByText("Journée pédagogique")).toBeInTheDocument()
    expect(screen.getByText(/août 2026/i)).toBeInTheDocument()
    expect(screen.getByText(/septembre 2026/i)).toBeInTheDocument()
  })

  it("affiche le badge « Toute la journée » pour un événement allDay", () => {
    render(<EventList events={events} canManage={false} />)
    expect(screen.getByText("Toute la journée")).toBeInTheDocument()
  })

  it("n'affiche pas le menu de gestion sans la permission", () => {
    render(<EventList events={events} canManage={false} />)
    expect(screen.queryByRole("button", { name: /more/i })).not.toBeInTheDocument()
  })
})
