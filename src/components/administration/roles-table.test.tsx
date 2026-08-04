import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { deleteRoleAction } from "@/app/actions/roles"
import { RolesTable, type RoleRow } from "@/components/administration/roles-table"

vi.mock("@/app/actions/roles", () => ({
  deleteRoleAction: vi.fn(),
}))

const mockRefresh = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: mockRefresh,
  }),
}))

const mockToastSuccess = vi.fn()
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}))

const mockedDeleteRoleAction = vi.mocked(deleteRoleAction)

const roles: RoleRow[] = [
  {
    id: "admin",
    name: "Administrateur",
    description: "Accès complet à l'application.",
    isSystem: true,
    userCount: 1,
    permissions: [],
  },
  {
    id: "member",
    name: "Membre",
    description: null,
    isSystem: true,
    userCount: 3,
    permissions: ["settings:read"],
  },
  {
    id: "comptable",
    name: "Comptable",
    description: "Accès à la facturation.",
    isSystem: false,
    userCount: 1,
    permissions: ["user:read", "settings:read"],
  },
]

beforeEach(() => {
  mockedDeleteRoleAction.mockReset()
  mockRefresh.mockReset()
  mockToastSuccess.mockReset()
})

type RenderTableOptions = {
  canCreate?: boolean
  canUpdate?: boolean
  canDelete?: boolean
}

// Par défaut, les trois permissions sont accordées : la plupart des tests de
// ce fichier portent sur autre chose que le filtrage par permission (voir
// `describe("RolesTable — permissions")` ci-dessous pour ce cas précis), pas
// la peine de le répéter à chaque appel.
function renderTable({
  canCreate = true,
  canUpdate = true,
  canDelete = true,
}: RenderTableOptions = {}) {
  return render(
    <RolesTable
      roles={roles}
      adminRoleId="admin"
      memberRoleId="member"
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
    />,
  )
}

describe("RolesTable — tableau", () => {
  it("affiche une ligne par rôle avec description, utilisateurs et permissions", () => {
    renderTable()

    expect(screen.getByText("Administrateur")).toBeInTheDocument()
    expect(screen.getByText("Toutes")).toBeInTheDocument()

    const memberRow = screen.getByText("Membre").closest("tr")!
    expect(within(memberRow).getByText("3 utilisateurs")).toBeInTheDocument()
    expect(within(memberRow).getByText("1 permission")).toBeInTheDocument()

    const comptableRow = screen.getByText("Comptable").closest("tr")!
    expect(within(comptableRow).getByText("comptable")).toBeInTheDocument()
    expect(
      within(comptableRow).getByText("Accès à la facturation."),
    ).toBeInTheDocument()
    expect(within(comptableRow).getByText("1 utilisateur")).toBeInTheDocument()
    expect(within(comptableRow).getByText("2 permissions")).toBeInTheDocument()
  })

  it("verrouille le rôle admin : icône cadenas, pas de menu d'actions", () => {
    renderTable()

    const adminRow = screen.getByText("Administrateur").closest("tr")!
    expect(
      within(adminRow).queryByRole("button", { name: /actions pour/i }),
    ).not.toBeInTheDocument()
    expect(within(adminRow).getByText("Rôle protégé")).toBeInTheDocument()
  })

  it("le rôle membre est modifiable mais pas supprimable", async () => {
    const user = userEvent.setup()
    renderTable()

    const memberRow = screen.getByText("Membre").closest("tr")!
    await user.click(
      within(memberRow).getByRole("button", { name: /actions pour membre/i }),
    )

    expect(
      await screen.findByRole("menuitem", { name: "Modifier" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("menuitem", { name: "Supprimer" }),
    ).not.toBeInTheDocument()
  })

  it("un rôle personnalisé a Modifier et Supprimer dans son menu d'actions", async () => {
    const user = userEvent.setup()
    renderTable()

    const comptableRow = screen.getByText("Comptable").closest("tr")!
    await user.click(
      within(comptableRow).getByRole("button", {
        name: /actions pour comptable/i,
      }),
    )

    expect(
      await screen.findByRole("menuitem", { name: "Modifier" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("menuitem", { name: "Supprimer" }),
    ).toBeInTheDocument()
  })

  it("les boutons Créer un rôle et Modifier pointent vers les pages dédiées", async () => {
    const user = userEvent.setup()
    renderTable()

    expect(
      screen.getByRole("button", { name: /créer un rôle/i }),
    ).toHaveAttribute("href", "/administration/roles/nouveau")

    const comptableRow = screen.getByText("Comptable").closest("tr")!
    await user.click(
      within(comptableRow).getByRole("button", {
        name: /actions pour comptable/i,
      }),
    )
    // Voir le commentaire équivalent dans users-table.test.tsx : Base UI
    // force role="menuitem" sur l'élément rendu, même via `render={<Link />}`.
    expect(
      await screen.findByRole("menuitem", { name: "Modifier" }),
    ).toHaveAttribute("href", "/administration/roles/comptable")
  })
})

describe("RolesTable — suppression", () => {
  async function openDeleteDialog(rowName: string) {
    const user = userEvent.setup()
    renderTable()
    const row = screen.getByText(rowName).closest("tr")!
    await user.click(
      within(row).getByRole("button", { name: `Actions pour ${rowName}` }),
    )
    await user.click(
      await screen.findByRole("menuitem", { name: "Supprimer" }),
    )
    await screen.findByRole("heading", {
      name: `Supprimer le rôle ${rowName} ?`,
    })
    return user
  }

  it("confirme la suppression puis affiche un succès", async () => {
    mockedDeleteRoleAction.mockResolvedValue({})
    const user = await openDeleteDialog("Comptable")

    await user.click(screen.getByRole("button", { name: "Supprimer" }))

    await waitFor(() => {
      expect(mockedDeleteRoleAction).toHaveBeenCalledWith("comptable")
    })
    expect(mockToastSuccess).toHaveBeenCalledWith("Le rôle a été supprimé.")
    expect(mockRefresh).toHaveBeenCalled()
  })

  it("affiche le garde-fou serveur (rôle encore utilisé) dans une alerte inline", async () => {
    mockedDeleteRoleAction.mockResolvedValue({
      error: "Impossible de supprimer ce rôle : 1 utilisateur l'utilise encore.",
    })
    const user = await openDeleteDialog("Comptable")

    await user.click(screen.getByRole("button", { name: "Supprimer" }))

    const alerte = await screen.findByRole("alert")
    expect(alerte).toHaveTextContent(
      "Impossible de supprimer ce rôle : 1 utilisateur l'utilise encore.",
    )
    expect(mockToastSuccess).not.toHaveBeenCalled()
  })
})

describe("RolesTable — permissions", () => {
  it("masque le bouton Créer sans role:create", () => {
    renderTable({ canCreate: false })

    expect(
      screen.queryByRole("button", { name: /créer un rôle/i }),
    ).not.toBeInTheDocument()
  })

  it("masque Modifier dans le menu sans role:update, garde Supprimer", async () => {
    const user = userEvent.setup()
    renderTable({ canUpdate: false })

    const comptableRow = screen.getByText("Comptable").closest("tr")!
    await user.click(
      within(comptableRow).getByRole("button", {
        name: /actions pour comptable/i,
      }),
    )

    expect(
      screen.queryByRole("menuitem", { name: "Modifier" }),
    ).not.toBeInTheDocument()
    expect(
      await screen.findByRole("menuitem", { name: "Supprimer" }),
    ).toBeInTheDocument()
  })

  it("masque Supprimer dans le menu sans role:delete, garde Modifier", async () => {
    const user = userEvent.setup()
    renderTable({ canDelete: false })

    const comptableRow = screen.getByText("Comptable").closest("tr")!
    await user.click(
      within(comptableRow).getByRole("button", {
        name: /actions pour comptable/i,
      }),
    )

    expect(
      await screen.findByRole("menuitem", { name: "Modifier" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("menuitem", { name: "Supprimer" }),
    ).not.toBeInTheDocument()
  })

  it("masque toute la colonne Actions (en-tête compris, y compris le cadenas admin) sans role:update ni role:delete", () => {
    renderTable({ canUpdate: false, canDelete: false })

    expect(
      screen.queryByRole("columnheader", { name: "Actions" }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText("Rôle protégé")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /actions pour/i }),
    ).not.toBeInTheDocument()
  })

  it("masque le menu d'actions du rôle membre sans role:update ni role:delete-sur-membre (permission role:delete seule, système bloque quand même)", async () => {
    // Avec seulement role:delete accordé (pas role:update), la ligne
    // "Membre" ne peut ni être modifiée (permission manquante) ni supprimée
    // (règle système, voir isMember dans RolesTable) : son menu d'actions
    // doit disparaître entièrement, même si la colonne existe encore pour
    // les autres lignes (ex. Comptable, supprimable).
    renderTable({ canUpdate: false, canDelete: true })

    const memberRow = screen.getByText("Membre").closest("tr")!
    expect(
      within(memberRow).queryByRole("button", { name: /actions pour/i }),
    ).not.toBeInTheDocument()

    const comptableRow = screen.getByText("Comptable").closest("tr")!
    expect(
      within(comptableRow).getByRole("button", { name: /actions pour/i }),
    ).toBeInTheDocument()
  })
})
