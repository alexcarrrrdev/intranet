import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { forgotPasswordAction } from "@/app/actions/auth"
import { ForgotPasswordForm } from "@/components/forgot-password-form"

vi.mock("@/app/actions/auth", () => ({
  forgotPasswordAction: vi.fn(),
}))

const mockedForgotPasswordAction = vi.mocked(forgotPasswordAction)

beforeEach(() => {
  mockedForgotPasswordAction.mockReset()
  mockedForgotPasswordAction.mockResolvedValue(undefined)
})

describe("ForgotPasswordForm", () => {
  it("affiche le champ courriel et le bouton d'envoi", () => {
    render(<ForgotPasswordForm />)

    expect(screen.getByLabelText("Courriel")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /envoyer le lien/i }),
    ).toBeInTheDocument()
  })

  it("affiche une erreur de validation pour un courriel invalide", async () => {
    const user = userEvent.setup()
    render(<ForgotPasswordForm />)

    await user.type(screen.getByLabelText("Courriel"), "pas-un-courriel")
    // Voir le commentaire équivalent dans login-form.test.tsx : fireEvent.submit
    // contourne un artefact de @testing-library/user-event avec un champ déjà
    // "dirty" et une validation asynchrone (zodResolver).
    fireEvent.submit(screen.getByRole("button", { name: /envoyer le lien/i }))

    expect(
      await screen.findByText("Entrez un courriel valide."),
    ).toBeInTheDocument()
    expect(mockedForgotPasswordAction).not.toHaveBeenCalled()
  })

  it("appelle l'action avec le courriel saisi puis affiche le message neutre", async () => {
    const user = userEvent.setup()
    render(<ForgotPasswordForm />)

    await user.type(screen.getByLabelText("Courriel"), "alex@exemple.com")
    await user.click(screen.getByRole("button", { name: /envoyer le lien/i }))

    await waitFor(() => {
      expect(mockedForgotPasswordAction).toHaveBeenCalledWith({
        email: "alex@exemple.com",
      })
    })

    // Message neutre affiché qu'un compte existe ou non avec ce courriel,
    // pour éviter l'énumération de comptes.
    expect(
      await screen.findByText(
        /si un compte existe avec cette adresse courriel/i,
      ),
    ).toBeInTheDocument()
  })
})
