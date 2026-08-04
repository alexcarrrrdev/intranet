import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { updateUserAction } from "@/app/actions/users"
import type { UserDetail } from "@/lib/auth/users"
import { UserEditForm } from "@/components/administration/user-edit-form"
import type { RoleOption } from "@/components/administration/user-create-form"

vi.mock("@/app/actions/users", () => ({
  updateUserAction: vi.fn(),
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

const mockedUpdateUserAction = vi.mocked(updateUserAction)

const roles: RoleOption[] = [
  { id: "admin", name: "Administrateur" },
  { id: "member", name: "Membre" },
]

const samTremblay: UserDetail = {
  id: "u2",
  name: "Sam Tremblay",
  email: "sam@exemple.com",
  role: "member",
}

const alexCaron: UserDetail = {
  id: "u1",
  name: "Alex Caron",
  email: "alex@exemple.com",
  role: "admin",
}

beforeEach(() => {
  mockedUpdateUserAction.mockReset()
  mockPush.mockReset()
  mockRefresh.mockReset()
  mockToastSuccess.mockReset()
})

describe("UserEditForm", () => {
  it("préremplit le formulaire avec le nom actuel et le courriel en lecture seule", () => {
    render(<UserEditForm user={samTremblay} roles={roles} />)

    expect(screen.getByLabelText("Nom")).toHaveValue("Sam Tremblay")
    const emailInput = screen.getByLabelText("Courriel")
    expect(emailInput).toHaveValue("sam@exemple.com")
    expect(emailInput).toBeDisabled()
    expect(
      screen.getByText("Le courriel ne peut pas être modifié pour le moment."),
    ).toBeInTheDocument()
  })

  it("affiche le nom du rôle actuel (pas son identifiant brut) dans le sélecteur", () => {
    render(<UserEditForm user={samTremblay} roles={roles} />)

    // La valeur initiale du Select vient de defaultValues, pas d'une
    // sélection dans le menu déjà ouvert : sans rendu explicite (voir
    // roleLabel dans user-edit-form.tsx), Base UI afficherait l'identifiant
    // brut ("member") plutôt que le nom du rôle ("Membre").
    expect(screen.getByRole("combobox")).toHaveTextContent("Membre")
    expect(screen.getByRole("combobox")).not.toHaveTextContent("member")
  })

  it("le bouton Annuler pointe vers la liste des utilisateurs", () => {
    render(<UserEditForm user={samTremblay} roles={roles} />)

    expect(screen.getByRole("button", { name: "Annuler" })).toHaveAttribute(
      "href",
      "/administration/utilisateurs",
    )
  })

  it("soumet les valeurs modifiées puis navigue vers la liste avec un succès", async () => {
    mockedUpdateUserAction.mockResolvedValue({})
    const user = userEvent.setup()
    render(<UserEditForm user={samTremblay} roles={roles} />)

    const nameInput = screen.getByLabelText("Nom")
    await user.clear(nameInput)
    await user.type(nameInput, "Samuel Tremblay")
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))

    await waitFor(() => {
      expect(mockedUpdateUserAction).toHaveBeenCalledWith("u2", {
        name: "Samuel Tremblay",
        role: "member",
      })
    })
    expect(mockToastSuccess).toHaveBeenCalledWith("L'utilisateur a été modifié.")
    expect(mockPush).toHaveBeenCalledWith("/administration/utilisateurs")
    // Voir le commentaire équivalent dans user-create-form.test.tsx.
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it("permet de changer le rôle d'un autre utilisateur", async () => {
    mockedUpdateUserAction.mockResolvedValue({})
    const user = userEvent.setup()
    render(<UserEditForm user={samTremblay} roles={roles} />)

    await user.click(screen.getByRole("combobox"))
    await user.click(await screen.findByRole("option", { name: "Administrateur" }))
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))

    await waitFor(() => {
      expect(mockedUpdateUserAction).toHaveBeenCalledWith("u2", {
        name: "Sam Tremblay",
        role: "admin",
      })
    })
  })

  it("affiche le garde-fou serveur (propre rôle) dans une alerte inline, sans naviguer", async () => {
    mockedUpdateUserAction.mockResolvedValue({
      error: "Vous ne pouvez pas modifier votre propre rôle.",
    })
    const user = userEvent.setup()
    render(<UserEditForm user={alexCaron} roles={roles} />)

    await user.click(screen.getByRole("combobox"))
    await user.click(await screen.findByRole("option", { name: "Membre" }))
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))

    const alerte = await screen.findByRole("alert")
    expect(alerte).toHaveTextContent(
      "Vous ne pouvez pas modifier votre propre rôle.",
    )
    expect(mockToastSuccess).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })
})
