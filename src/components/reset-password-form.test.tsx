import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { resetPasswordAction } from "@/app/actions/auth"
import { ResetPasswordForm } from "@/components/reset-password-form"

vi.mock("@/app/actions/auth", () => ({
  resetPasswordAction: vi.fn(),
}))

const mockedResetPasswordAction = vi.mocked(resetPasswordAction)

beforeEach(() => {
  mockedResetPasswordAction.mockReset()
})

describe("ResetPasswordForm", () => {
  const token = "un-jeton-de-test"

  it("affiche une erreur quand les mots de passe ne correspondent pas", async () => {
    const user = userEvent.setup()
    render(<ResetPasswordForm token={token} />)

    await user.type(
      screen.getByLabelText("Nouveau mot de passe"),
      "motdepasse123",
    )
    await user.type(
      screen.getByLabelText("Confirmer le mot de passe"),
      "autrechose123",
    )
    await user.click(
      screen.getByRole("button", { name: /réinitialiser le mot de passe/i }),
    )

    expect(
      await screen.findByText("Les mots de passe ne correspondent pas."),
    ).toBeInTheDocument()
    expect(mockedResetPasswordAction).not.toHaveBeenCalled()
  })

  it("appelle l'action avec le nouveau mot de passe et le jeton", async () => {
    mockedResetPasswordAction.mockResolvedValue({})
    const user = userEvent.setup()
    render(<ResetPasswordForm token={token} />)

    await user.type(
      screen.getByLabelText("Nouveau mot de passe"),
      "motdepasse123",
    )
    await user.type(
      screen.getByLabelText("Confirmer le mot de passe"),
      "motdepasse123",
    )
    await user.click(
      screen.getByRole("button", { name: /réinitialiser le mot de passe/i }),
    )

    await waitFor(() => {
      expect(mockedResetPasswordAction).toHaveBeenCalledWith(
        { password: "motdepasse123", confirmPassword: "motdepasse123" },
        token,
      )
    })
  })

  it("affiche l'erreur retournée par l'action directement dans le formulaire", async () => {
    mockedResetPasswordAction.mockResolvedValue({
      error: "Ce lien de réinitialisation est invalide ou a expiré.",
    })
    const user = userEvent.setup()
    render(<ResetPasswordForm token={token} />)

    await user.type(
      screen.getByLabelText("Nouveau mot de passe"),
      "motdepasse123",
    )
    await user.type(
      screen.getByLabelText("Confirmer le mot de passe"),
      "motdepasse123",
    )
    await user.click(
      screen.getByRole("button", { name: /réinitialiser le mot de passe/i }),
    )

    const alerte = await screen.findByRole("alert")
    expect(alerte).toHaveTextContent(
      "Ce lien de réinitialisation est invalide ou a expiré.",
    )
  })
})
