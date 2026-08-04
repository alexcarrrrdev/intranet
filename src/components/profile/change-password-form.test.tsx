import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { changePasswordAction } from "@/app/actions/profile"
import { ChangePasswordForm } from "@/components/profile/change-password-form"

vi.mock("@/app/actions/profile", () => ({
  changePasswordAction: vi.fn(),
}))

const mockToastSuccess = vi.fn()
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}))

const mockedChangePasswordAction = vi.mocked(changePasswordAction)

beforeEach(() => {
  mockedChangePasswordAction.mockReset()
  mockToastSuccess.mockReset()
})

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  values: { current: string; next: string; confirm: string },
) {
  await user.type(screen.getByLabelText("Mot de passe actuel"), values.current)
  await user.type(screen.getByLabelText("Nouveau mot de passe"), values.next)
  await user.type(
    screen.getByLabelText("Confirmer le nouveau mot de passe"),
    values.confirm,
  )
}

describe("ChangePasswordForm", () => {
  it("affiche les trois champs et le bouton de soumission", () => {
    render(<ChangePasswordForm />)

    expect(screen.getByLabelText("Mot de passe actuel")).toBeInTheDocument()
    expect(screen.getByLabelText("Nouveau mot de passe")).toBeInTheDocument()
    expect(
      screen.getByLabelText("Confirmer le nouveau mot de passe"),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /changer le mot de passe/i }),
    ).toBeInTheDocument()
  })

  it("affiche une erreur de validation quand la confirmation ne correspond pas", async () => {
    const user = userEvent.setup()
    render(<ChangePasswordForm />)

    await fillForm(user, {
      current: "ancien-mot-de-passe",
      next: "nouveau-mot-de-passe",
      confirm: "autre-chose",
    })
    fireEvent.submit(
      screen.getByRole("button", { name: /changer le mot de passe/i }),
    )

    expect(
      await screen.findByText("Les mots de passe ne correspondent pas."),
    ).toBeInTheDocument()
    expect(mockedChangePasswordAction).not.toHaveBeenCalled()
  })

  it("affiche une erreur de validation quand le nouveau mot de passe est trop court", async () => {
    const user = userEvent.setup()
    render(<ChangePasswordForm />)

    await fillForm(user, {
      current: "ancien-mot-de-passe",
      next: "court1",
      confirm: "court1",
    })
    fireEvent.submit(
      screen.getByRole("button", { name: /changer le mot de passe/i }),
    )

    expect(
      await screen.findByText(
        "Le nouveau mot de passe doit contenir au moins 8 caractères.",
      ),
    ).toBeInTheDocument()
    expect(mockedChangePasswordAction).not.toHaveBeenCalled()
  })

  it("appelle l'action avec les valeurs saisies puis vide le formulaire", async () => {
    mockedChangePasswordAction.mockResolvedValue({})
    const user = userEvent.setup()
    render(<ChangePasswordForm />)

    await fillForm(user, {
      current: "ancien-mot-de-passe",
      next: "nouveau-mot-de-passe",
      confirm: "nouveau-mot-de-passe",
    })
    await user.click(
      screen.getByRole("button", { name: /changer le mot de passe/i }),
    )

    await waitFor(() => {
      expect(mockedChangePasswordAction).toHaveBeenCalledWith({
        currentPassword: "ancien-mot-de-passe",
        newPassword: "nouveau-mot-de-passe",
        confirmPassword: "nouveau-mot-de-passe",
      })
    })
    expect(mockToastSuccess).toHaveBeenCalledWith(
      "Votre mot de passe a été modifié.",
    )
    await waitFor(() => {
      expect(screen.getByLabelText("Mot de passe actuel")).toHaveValue("")
    })
  })

  it("affiche l'erreur de mot de passe actuel incorrect directement dans le formulaire", async () => {
    mockedChangePasswordAction.mockResolvedValue({
      error: "Le mot de passe actuel est incorrect.",
    })
    const user = userEvent.setup()
    render(<ChangePasswordForm />)

    await fillForm(user, {
      current: "mauvais-mot-de-passe",
      next: "nouveau-mot-de-passe",
      confirm: "nouveau-mot-de-passe",
    })
    await user.click(
      screen.getByRole("button", { name: /changer le mot de passe/i }),
    )

    const alerte = await screen.findByRole("alert")
    expect(alerte).toHaveTextContent("Le mot de passe actuel est incorrect.")
    expect(mockToastSuccess).not.toHaveBeenCalled()
  })
})
