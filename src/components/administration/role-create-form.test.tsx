import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { createRoleAction } from "@/app/actions/roles"
import { RoleCreateForm } from "@/components/administration/role-create-form"
import type { PermissionCatalogEntry } from "@/components/administration/permission-matrix"

vi.mock("@/app/actions/roles", () => ({
  createRoleAction: vi.fn(),
}))

const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

const mockToastSuccess = vi.fn()
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}))

const mockedCreateRoleAction = vi.mocked(createRoleAction)

// Reflète le catalogue réel (`statement`, src/lib/auth/permissions.ts) et
// ses libellés français, tels que mis en forme par
// src/app/(dashboard)/administration/roles/nouveau/page.tsx.
const catalog: PermissionCatalogEntry[] = [
  {
    resource: "user",
    label: "Utilisateurs",
    actions: [
      { action: "create", label: "Créer" },
      { action: "read", label: "Consulter" },
      { action: "update", label: "Modifier" },
      { action: "delete", label: "Supprimer" },
    ],
  },
  {
    resource: "settings",
    label: "Paramètres",
    actions: [
      { action: "read", label: "Consulter" },
      { action: "update", label: "Modifier" },
    ],
  },
  {
    resource: "role",
    label: "Rôles",
    actions: [
      { action: "create", label: "Créer" },
      { action: "read", label: "Consulter" },
      { action: "update", label: "Modifier" },
      { action: "delete", label: "Supprimer" },
    ],
  },
]

function actionCheckbox(resourceLabel: string, actionLabel: string) {
  const section = screen.getByText(resourceLabel).closest("div")!
  return within(section).getByRole("checkbox", { name: actionLabel })
}

beforeEach(() => {
  mockedCreateRoleAction.mockReset()
  mockPush.mockReset()
  mockRefresh.mockReset()
  mockToastSuccess.mockReset()
})

describe("RoleCreateForm — mise en page", () => {
  it("affiche les sections Informations et Permissions", () => {
    render(<RoleCreateForm catalog={catalog} />)

    expect(screen.getByText("Informations")).toBeInTheDocument()
    expect(screen.getByText("Permissions")).toBeInTheDocument()
  })

  it("le bouton Annuler pointe vers la liste des rôles", () => {
    render(<RoleCreateForm catalog={catalog} />)

    expect(screen.getByRole("button", { name: "Annuler" })).toHaveAttribute(
      "href",
      "/administration/roles",
    )
  })

  it("affiche une section par ressource et une case par action du catalogue", () => {
    render(<RoleCreateForm catalog={catalog} />)

    for (const entry of catalog) {
      expect(screen.getByText(entry.label)).toBeInTheDocument()
    }
    // "Consulter" apparaît dans les 3 ressources du catalogue de test.
    expect(screen.getAllByRole("checkbox", { name: "Consulter" })).toHaveLength(3)
  })
})

describe("RoleCreateForm — identifiant technique masqué", () => {
  it("n'expose aucun champ Identifiant : le slug est dérivé côté serveur", () => {
    render(<RoleCreateForm catalog={catalog} />)

    expect(screen.queryByLabelText("Identifiant")).not.toBeInTheDocument()
  })
})

describe("RoleCreateForm — soumission", () => {
  it("cocher des cases construit la liste de permissions transmise à l'action", async () => {
    mockedCreateRoleAction.mockResolvedValue({})
    const user = userEvent.setup()
    render(<RoleCreateForm catalog={catalog} />)

    await user.type(screen.getByLabelText("Nom"), "Comptable")
    await user.click(actionCheckbox("Utilisateurs", "Consulter"))
    await user.click(actionCheckbox("Paramètres", "Consulter"))
    await user.click(screen.getByRole("button", { name: "Créer" }))

    await waitFor(() => {
      expect(mockedCreateRoleAction).toHaveBeenCalledTimes(1)
    })
    const submitted = mockedCreateRoleAction.mock.calls[0]?.[0]
    expect(submitted?.name).toBe("Comptable")
    // Aucun identifiant transmis : il est dérivé du nom côté serveur.
    expect(submitted?.id).toBeUndefined()
    expect(submitted?.permissions).toHaveLength(2)
    expect(submitted?.permissions).toEqual(
      expect.arrayContaining(["user:read", "settings:read"]),
    )
    expect(mockToastSuccess).toHaveBeenCalledWith("Le rôle a été créé.")
    expect(mockPush).toHaveBeenCalledWith("/administration/roles")
    // Voir le commentaire équivalent dans user-create-form.test.tsx.
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it("décocher une case retire la permission de la liste", async () => {
    mockedCreateRoleAction.mockResolvedValue({})
    const user = userEvent.setup()
    render(<RoleCreateForm catalog={catalog} />)

    await user.type(screen.getByLabelText("Nom"), "Comptable")
    const readUser = actionCheckbox("Utilisateurs", "Consulter")
    const readSettings = actionCheckbox("Paramètres", "Consulter")
    await user.click(readUser)
    await user.click(readSettings)
    await user.click(readSettings)
    await user.click(screen.getByRole("button", { name: "Créer" }))

    await waitFor(() => {
      expect(mockedCreateRoleAction).toHaveBeenCalledTimes(1)
    })
    expect(mockedCreateRoleAction.mock.calls[0]?.[0]?.permissions).toEqual([
      "user:read",
    ])
  })

  it("affiche l'erreur retournée par l'action dans une alerte inline, sans naviguer", async () => {
    mockedCreateRoleAction.mockResolvedValue({
      error: "Un rôle au nom similaire (« Comptable ») existe déjà. Choisissez un autre nom.",
    })
    const user = userEvent.setup()
    render(<RoleCreateForm catalog={catalog} />)

    await user.type(screen.getByLabelText("Nom"), "Comptable")
    await user.click(screen.getByRole("button", { name: "Créer" }))

    const alerte = await screen.findByRole("alert")
    expect(alerte).toHaveTextContent(
      "Un rôle au nom similaire (« Comptable ») existe déjà. Choisissez un autre nom.",
    )
    expect(mockToastSuccess).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })
})
