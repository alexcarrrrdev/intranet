import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { updateNameAction } from "@/app/actions/profile"
import { ProfileNameForm } from "@/components/profile/profile-name-form"

vi.mock("@/app/actions/profile", () => ({
  updateNameAction: vi.fn(),
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

const mockedUpdateNameAction = vi.mocked(updateNameAction)

beforeEach(() => {
  mockedUpdateNameAction.mockReset()
  mockRefresh.mockReset()
  mockToastSuccess.mockReset()
})

describe("ProfileNameForm", () => {
  it("affiche le nom modifiable, le courriel et le rôle en lecture seule", () => {
    render(
      <ProfileNameForm
        defaultName="Alex Caron"
        email="alex@exemple.com"
        roleLabel="Administrateur"
      />,
    )

    expect(screen.getByLabelText("Nom complet")).toHaveValue("Alex Caron")

    const emailField = screen.getByLabelText("Courriel")
    expect(emailField).toHaveValue("alex@exemple.com")
    expect(emailField).toBeDisabled()

    const roleField = screen.getByLabelText("Rôle")
    expect(roleField).toHaveValue("Administrateur")
    expect(roleField).toBeDisabled()

    expect(
      screen.getByText(/ne peut pas être modifié pour le moment/i),
    ).toBeInTheDocument()
  })

  it("affiche une erreur de validation quand le nom est vidé", async () => {
    const user = userEvent.setup()
    render(
      <ProfileNameForm
        defaultName="Alex Caron"
        email="alex@exemple.com"
        roleLabel="Administrateur"
      />,
    )

    await user.clear(screen.getByLabelText("Nom complet"))
    fireEvent.submit(screen.getByRole("button", { name: /enregistrer/i }))

    expect(await screen.findByText("Le nom est requis.")).toBeInTheDocument()
    expect(mockedUpdateNameAction).not.toHaveBeenCalled()
  })

  it("appelle l'action avec le nouveau nom puis affiche un succès", async () => {
    mockedUpdateNameAction.mockResolvedValue({})
    const user = userEvent.setup()
    render(
      <ProfileNameForm
        defaultName="Alex Caron"
        email="alex@exemple.com"
        roleLabel="Administrateur"
      />,
    )

    await user.clear(screen.getByLabelText("Nom complet"))
    await user.type(screen.getByLabelText("Nom complet"), "Alex C. Caron")
    await user.click(screen.getByRole("button", { name: /enregistrer/i }))

    await waitFor(() => {
      expect(mockedUpdateNameAction).toHaveBeenCalledWith({
        name: "Alex C. Caron",
      })
    })
    expect(mockToastSuccess).toHaveBeenCalledWith(
      "Vos informations ont été enregistrées.",
    )
    expect(mockRefresh).toHaveBeenCalled()
  })

  it("affiche l'erreur retournée par l'action dans le formulaire", async () => {
    mockedUpdateNameAction.mockResolvedValue({
      error: "Une erreur est survenue. Réessayez plus tard.",
    })
    const user = userEvent.setup()
    render(
      <ProfileNameForm
        defaultName="Alex Caron"
        email="alex@exemple.com"
        roleLabel="Administrateur"
      />,
    )

    await user.click(screen.getByRole("button", { name: /enregistrer/i }))

    const alerte = await screen.findByRole("alert")
    expect(alerte).toHaveTextContent("Une erreur est survenue. Réessayez plus tard.")
    expect(mockToastSuccess).not.toHaveBeenCalled()
  })
})
