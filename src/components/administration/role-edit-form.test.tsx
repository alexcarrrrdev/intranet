import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { updateRoleAction } from "@/app/actions/roles"
import type { RoleDetail } from "@/lib/auth/roles"
import { RoleEditForm } from "@/components/administration/role-edit-form"
import type { PermissionCatalogEntry } from "@/components/administration/permission-matrix"

vi.mock("@/app/actions/roles", () => ({
  updateRoleAction: vi.fn(),
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

const mockedUpdateRoleAction = vi.mocked(updateRoleAction)

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
]

const comptableRole: RoleDetail = {
  id: "comptable",
  name: "Comptable",
  description: "Accès à la facturation.",
  isSystem: false,
  permissions: ["user:read", "settings:read"],
}

const adminRole: RoleDetail = {
  id: "admin",
  name: "Administrateur",
  description: null,
  isSystem: true,
  permissions: ["user:create", "user:read", "user:update", "settings:read"],
}

function actionCheckbox(resourceLabel: string, actionLabel: string) {
  const section = screen.getByText(resourceLabel).closest("div")!
  return within(section).getByRole("checkbox", { name: actionLabel })
}

beforeEach(() => {
  mockedUpdateRoleAction.mockReset()
  mockPush.mockReset()
  mockRefresh.mockReset()
  mockToastSuccess.mockReset()
})

describe("RoleEditForm — rôle personnalisé (modifiable)", () => {
  it("n'expose pas l'identifiant technique et préremplit les permissions accordées", () => {
    render(
      <RoleEditForm role={comptableRole} catalog={catalog} readOnly={false} />,
    )

    expect(screen.queryByLabelText("Identifiant")).not.toBeInTheDocument()
    expect(actionCheckbox("Utilisateurs", "Consulter")).toBeChecked()
    expect(actionCheckbox("Paramètres", "Consulter")).toBeChecked()
    expect(actionCheckbox("Utilisateurs", "Créer")).not.toBeChecked()
  })

  it("le bouton Annuler pointe vers la liste des rôles", () => {
    render(
      <RoleEditForm role={comptableRole} catalog={catalog} readOnly={false} />,
    )

    expect(screen.getByRole("button", { name: "Annuler" })).toHaveAttribute(
      "href",
      "/administration/roles",
    )
  })

  it("soumet les permissions modifiées puis navigue vers la liste avec un succès", async () => {
    mockedUpdateRoleAction.mockResolvedValue({})
    const user = userEvent.setup()
    render(
      <RoleEditForm role={comptableRole} catalog={catalog} readOnly={false} />,
    )

    await user.click(actionCheckbox("Utilisateurs", "Créer"))
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))

    await waitFor(() => {
      expect(mockedUpdateRoleAction).toHaveBeenCalledTimes(1)
    })
    const [id, values] = mockedUpdateRoleAction.mock.calls[0]!
    expect(id).toBe("comptable")
    expect(values.permissions).toEqual(
      expect.arrayContaining(["user:read", "settings:read", "user:create"]),
    )
    expect(values.permissions).toHaveLength(3)
    expect(mockToastSuccess).toHaveBeenCalledWith("Le rôle a été modifié.")
    expect(mockPush).toHaveBeenCalledWith("/administration/roles")
    // Voir le commentaire équivalent dans user-create-form.test.tsx.
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it("affiche le garde-fou serveur dans une alerte inline, sans naviguer", async () => {
    mockedUpdateRoleAction.mockResolvedValue({
      error: "Ce rôle est introuvable.",
    })
    const user = userEvent.setup()
    render(
      <RoleEditForm role={comptableRole} catalog={catalog} readOnly={false} />,
    )

    await user.click(screen.getByRole("button", { name: "Enregistrer" }))

    const alerte = await screen.findByRole("alert")
    expect(alerte).toHaveTextContent("Ce rôle est introuvable.")
    expect(mockToastSuccess).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })
})

describe("RoleEditForm — rôle admin (lecture seule)", () => {
  it("affiche une note explicative et aucun bouton d'enregistrement", () => {
    render(<RoleEditForm role={adminRole} catalog={catalog} readOnly />)

    expect(
      screen.getByText("Le rôle Administrateur ne peut pas être modifié."),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Enregistrer" }),
    ).not.toBeInTheDocument()
  })

  it("tous les champs et la matrice de permissions sont désactivés", () => {
    render(<RoleEditForm role={adminRole} catalog={catalog} readOnly />)

    expect(screen.getByLabelText("Nom")).toBeDisabled()
    // Le Checkbox Base UI rend un <span role="checkbox"> (pas un <input>) :
    // son état désactivé s'expose via aria-disabled, pas l'attribut natif
    // `disabled` que vérifie toBeDisabled() — voir src/components/ui/checkbox.tsx.
    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect(checkbox).toHaveAttribute("aria-disabled", "true")
    }
  })

  it("affiche la matrice avec toutes les permissions du rôle admin cochées", () => {
    render(<RoleEditForm role={adminRole} catalog={catalog} readOnly />)

    expect(actionCheckbox("Utilisateurs", "Créer")).toBeChecked()
    expect(actionCheckbox("Utilisateurs", "Consulter")).toBeChecked()
    expect(actionCheckbox("Utilisateurs", "Modifier")).toBeChecked()
    expect(actionCheckbox("Utilisateurs", "Supprimer")).not.toBeChecked()
    expect(actionCheckbox("Paramètres", "Consulter")).toBeChecked()
  })

  it("le bouton de retour pointe vers la liste des rôles", () => {
    render(<RoleEditForm role={adminRole} catalog={catalog} readOnly />)

    expect(
      screen.getByRole("button", { name: "Retour aux rôles" }),
    ).toHaveAttribute("href", "/administration/roles")
  })
})
