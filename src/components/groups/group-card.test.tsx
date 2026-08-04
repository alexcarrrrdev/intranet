import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { GroupCard } from "@/components/groups/group-card"
import type { GroupListItem } from "@/lib/groups/groups"

vi.mock("@/app/actions/groups", () => ({
  createGroupAction: vi.fn(),
  deleteGroupAction: vi.fn(),
  joinGroupAction: vi.fn(),
  leaveGroupAction: vi.fn(),
}))

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

const group: GroupListItem = {
  id: "group-1",
  name: "Comité social",
  description: "Organise les activités d'équipe",
  memberCount: 3,
  previewMembers: [
    { id: "u1", name: "Alex Caron", image: null },
    { id: "u2", name: "Sam Tremblay", image: null },
  ],
  isMember: false,
}

describe("GroupCard", () => {
  it("affiche le nom, la description et le nombre de membres", () => {
    render(<GroupCard group={group} canManage={false} />)
    expect(screen.getByText("Comité social")).toBeInTheDocument()
    expect(screen.getByText("Organise les activités d'équipe")).toBeInTheDocument()
    expect(screen.getByText("3 membres")).toBeInTheDocument()
  })

  it("propose Rejoindre quand l'utilisateur n'est pas membre", () => {
    render(<GroupCard group={group} canManage={false} />)
    expect(screen.getByRole("button", { name: "Rejoindre" })).toBeInTheDocument()
  })

  it("propose Quitter quand l'utilisateur est déjà membre", () => {
    render(<GroupCard group={{ ...group, isMember: true }} canManage={false} />)
    expect(screen.getByRole("button", { name: "Quitter" })).toBeInTheDocument()
  })

  it("n'affiche pas le menu de gestion sans la permission", () => {
    render(<GroupCard group={group} canManage={false} />)
    expect(screen.queryByRole("button", { name: /more/i })).not.toBeInTheDocument()
  })
})
