import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { createUserAction } from "@/app/actions/users"
import {
  UserCreateForm,
  type RoleOption,
} from "@/components/administration/user-create-form"

vi.mock("@/app/actions/users", () => ({
  createUserAction: vi.fn(),
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

const mockedCreateUserAction = vi.mocked(createUserAction)

const roles: RoleOption[] = [
  { id: "admin", name: "Administrateur" },
  { id: "member", name: "Membre" },
]

beforeEach(() => {
  mockedCreateUserAction.mockReset()
  mockPush.mockReset()
  mockRefresh.mockReset()
  mockToastSuccess.mockReset()
})

describe("UserCreateForm", () => {
  it("affiche les sections Informations et Rôle", () => {
    render(<UserCreateForm roles={roles} />)

    expect(screen.getByText("Informations")).toBeInTheDocument()
    // "Rôle" apparaît deux fois : le titre de la section (CardTitle, qui
    // n'est pas un vrai <h*>, voir src/components/ui/card.tsx) et le
    // libellé du champ Select — leur présence conjointe suffit à confirmer
    // que la section est bien rendue.
    expect(screen.getAllByText("Rôle", { exact: true })).toHaveLength(2)
  })

  it("le bouton Annuler pointe vers la liste des utilisateurs", () => {
    render(<UserCreateForm roles={roles} />)

    expect(screen.getByRole("button", { name: "Annuler" })).toHaveAttribute(
      "href",
      "/administration/utilisateurs",
    )
  })

  it("affiche une erreur de validation si le mot de passe est trop court", async () => {
    const user = userEvent.setup()
    render(<UserCreateForm roles={roles} />)

    await user.type(screen.getByLabelText("Nom"), "Nouvelle Personne")
    await user.type(screen.getByLabelText("Courriel"), "nouvelle@exemple.com")
    await user.type(screen.getByLabelText("Mot de passe initial"), "court1")
    await user.click(screen.getByRole("button", { name: "Créer" }))

    expect(
      await screen.findByText(
        "Le mot de passe doit contenir au moins 8 caractères.",
      ),
    ).toBeInTheDocument()
    expect(mockedCreateUserAction).not.toHaveBeenCalled()
  })

  it("affiche une erreur de validation si aucun rôle n'est sélectionné", async () => {
    const user = userEvent.setup()
    render(<UserCreateForm roles={roles} />)

    await user.type(screen.getByLabelText("Nom"), "Nouvelle Personne")
    await user.type(screen.getByLabelText("Courriel"), "nouvelle@exemple.com")
    await user.type(
      screen.getByLabelText("Mot de passe initial"),
      "motdepasse123",
    )
    await user.click(screen.getByRole("button", { name: "Créer" }))

    expect(await screen.findByText("Le rôle est requis.")).toBeInTheDocument()
    expect(mockedCreateUserAction).not.toHaveBeenCalled()
  })

  it("soumet les valeurs saisies puis navigue vers la liste avec un succès", async () => {
    mockedCreateUserAction.mockResolvedValue({})
    const user = userEvent.setup()
    render(<UserCreateForm roles={roles} />)

    await user.type(screen.getByLabelText("Nom"), "Nouvelle Personne")
    await user.type(screen.getByLabelText("Courriel"), "nouvelle@exemple.com")
    await user.type(
      screen.getByLabelText("Mot de passe initial"),
      "motdepasse123",
    )
    await user.click(screen.getByRole("combobox"))
    await user.click(await screen.findByRole("option", { name: "Membre" }))
    await user.click(screen.getByRole("button", { name: "Créer" }))

    await waitFor(() => {
      expect(mockedCreateUserAction).toHaveBeenCalledTimes(1)
    })
    expect(mockedCreateUserAction).toHaveBeenCalledWith({
      name: "Nouvelle Personne",
      email: "nouvelle@exemple.com",
      password: "motdepasse123",
      role: "member",
    })
    expect(mockToastSuccess).toHaveBeenCalledWith("L'utilisateur a été créé.")
    expect(mockPush).toHaveBeenCalledWith("/administration/utilisateurs")
    // Pas de router.refresh() : appelé juste après router.push() vers une
    // route dynamique (sans cache client, voir le commentaire de
    // user-create-form.tsx), il annule sa requête RSC en cours — vérifié
    // empiriquement en E2E, garde-fou de non-régression ici.
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it("affiche l'erreur retournée par l'action dans une alerte inline, sans naviguer", async () => {
    mockedCreateUserAction.mockResolvedValue({
      error: "Un compte existe déjà avec le courriel « nouvelle@exemple.com ».",
    })
    const user = userEvent.setup()
    render(<UserCreateForm roles={roles} />)

    await user.type(screen.getByLabelText("Nom"), "Nouvelle Personne")
    await user.type(screen.getByLabelText("Courriel"), "nouvelle@exemple.com")
    await user.type(
      screen.getByLabelText("Mot de passe initial"),
      "motdepasse123",
    )
    await user.click(screen.getByRole("combobox"))
    await user.click(await screen.findByRole("option", { name: "Membre" }))
    await user.click(screen.getByRole("button", { name: "Créer" }))

    const alerte = await screen.findByRole("alert")
    expect(alerte).toHaveTextContent(
      "Un compte existe déjà avec le courriel « nouvelle@exemple.com ».",
    )
    expect(mockToastSuccess).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })
})
