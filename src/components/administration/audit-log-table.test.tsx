import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  AuditLogTable,
  type AuditActorOption,
  type AuditLogRow,
} from "@/components/administration/audit-log-table"

const mockPush = vi.fn()
let mockSearchParams = new URLSearchParams()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/administration/journal",
  useSearchParams: () => mockSearchParams,
}))

beforeEach(() => {
  mockPush.mockReset()
  mockSearchParams = new URLSearchParams()
})

const actors: AuditActorOption[] = [
  { id: "user-1", label: "Alex Caron (alex@exemple.com)" },
  { id: "user-2", label: "Marie Tremblay (marie@exemple.com)" },
]

const entries: AuditLogRow[] = [
  {
    id: "entry-1",
    createdAt: new Date("2026-01-15T14:30:00Z"),
    actorLabel: "Alex Caron (alex@exemple.com)",
    action: "user.update",
    targetLabel: "Marie Tremblay (marie@exemple.com)",
    details: {
      name: { before: "Marie T." , after: "Marie Tremblay" },
    },
  },
  {
    id: "entry-2",
    createdAt: new Date("2026-01-15T13:00:00Z"),
    actorLabel: "Alex Caron (alex@exemple.com)",
    action: "auth.login",
    targetLabel: "",
    details: null,
  },
]

function renderTable(overrides: Partial<React.ComponentProps<typeof AuditLogTable>> = {}) {
  return render(
    <AuditLogTable
      entries={entries}
      total={entries.length}
      page={1}
      perPage={20}
      actors={actors}
      {...overrides}
    />,
  )
}

describe("AuditLogTable — tableau", () => {
  it("affiche une ligne par entrée avec le libellé français de l'action", () => {
    renderTable()

    expect(screen.getByText("Modification d'un utilisateur")).toBeInTheDocument()
    expect(screen.getByText("Connexion")).toBeInTheDocument()
    expect(screen.getAllByText("Alex Caron (alex@exemple.com)")).toHaveLength(2)
    expect(screen.getByText("Marie Tremblay (marie@exemple.com)")).toBeInTheDocument()
  })

  it("affiche le détail formaté (diff avant/après) pour l'entrée qui en a un", () => {
    renderTable()

    expect(screen.getByText('nom : « Marie T. » → « Marie Tremblay »')).toBeInTheDocument()
  })

  it("affiche un tiret quand l'entrée n'a pas de détail", () => {
    renderTable()

    const loginRow = screen.getByText("Connexion").closest("tr")!
    expect(loginRow).toHaveTextContent("—")
  })

  it("affiche un message quand il n'y a aucune entrée", () => {
    renderTable({ entries: [] })

    expect(screen.getByText("Aucune entrée.")).toBeInTheDocument()
  })

  it("affiche le nombre de pages et le total d'entrées", () => {
    renderTable({ total: 45, page: 2, perPage: 20 })

    expect(screen.getByText("Page 2 sur 3 (45 entrées)")).toBeInTheDocument()
  })
})

describe("AuditLogTable — pagination", () => {
  it("désactive Précédent sur la première page", () => {
    renderTable({ page: 1, total: 45, perPage: 20 })

    expect(screen.getByRole("button", { name: "Précédent" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Suivant" })).not.toBeDisabled()
  })

  it("désactive Suivant sur la dernière page", () => {
    renderTable({ page: 3, total: 45, perPage: 20 })

    expect(screen.getByRole("button", { name: "Suivant" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Précédent" })).not.toBeDisabled()
  })

  it("navigue vers la page suivante en conservant les filtres actifs", async () => {
    mockSearchParams = new URLSearchParams("action=user.update")
    const user = userEvent.setup()
    renderTable({ page: 1, total: 45, perPage: 20, actionFilter: "user.update" })

    await user.click(screen.getByRole("button", { name: "Suivant" }))

    expect(mockPush).toHaveBeenCalledWith(
      "/administration/journal?action=user.update&page=2",
    )
  })
})

describe("AuditLogTable — filtres", () => {
  // Base UI donne role="combobox" au déclencheur du Select, mais ce rôle
  // n'a pas de « nom accessible depuis son contenu » (contrairement à
  // role="button") : impossible de le cibler par un nom de contenu visible.
  // Comme user-edit-form.tsx (un seul Select, `getByRole("combobox")` sans
  // nom) — ici il y en a deux, distingués par position (Action en premier
  // dans le JSX, Acteur en second).
  it("propose toutes les actions du catalogue dans le filtre Action", async () => {
    const user = userEvent.setup()
    renderTable()

    const [actionCombobox] = screen.getAllByRole("combobox")
    await user.click(actionCombobox!)

    expect(await screen.findByRole("option", { name: "Création d'un rôle" })).toBeInTheDocument()
  })

  it("propose les acteurs fournis dans le filtre Acteur", async () => {
    const user = userEvent.setup()
    renderTable()

    const [, actorCombobox] = screen.getAllByRole("combobox")
    await user.click(actorCombobox!)

    expect(
      await screen.findByRole("option", { name: "Marie Tremblay (marie@exemple.com)" }),
    ).toBeInTheDocument()
  })
})
