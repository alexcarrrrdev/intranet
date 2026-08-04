import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { removeLogoAction, uploadLogoAction } from "@/app/actions/app-settings"
import { LogoUploadForm } from "@/components/administration/logo-upload-form"

vi.mock("@/app/actions/app-settings", () => ({
  uploadLogoAction: vi.fn(),
  removeLogoAction: vi.fn(),
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

const mockedUploadLogoAction = vi.mocked(uploadLogoAction)
const mockedRemoveLogoAction = vi.mocked(removeLogoAction)

function pngFile(name = "logo.png") {
  return new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], name, {
    type: "image/png",
  })
}

beforeEach(() => {
  mockedUploadLogoAction.mockReset()
  mockedRemoveLogoAction.mockReset()
  mockRefresh.mockReset()
  mockToastSuccess.mockReset()
})

describe("LogoUploadForm", () => {
  it("affiche la note de repli quand aucun logo n'est configuré", () => {
    render(<LogoUploadForm hasLogo={false} logoVersion={0} />)

    expect(
      screen.getByText(/aucun logo personnalisé n'est configuré/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /retirer le logo/i }),
    ).not.toBeInTheDocument()
  })

  it("affiche le bouton Retirer le logo quand un logo est configuré", () => {
    render(<LogoUploadForm hasLogo={true} logoVersion={42} />)

    expect(
      screen.queryByText(/aucun logo personnalisé n'est configuré/i),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /retirer le logo/i }),
    ).toBeInTheDocument()
  })

  it("affiche une erreur si on soumet sans fichier sélectionné", async () => {
    const user = userEvent.setup()
    render(<LogoUploadForm hasLogo={false} logoVersion={0} />)

    await user.click(screen.getByRole("button", { name: /téléverser/i }))

    expect(
      await screen.findByText("Veuillez sélectionner un fichier."),
    ).toBeInTheDocument()
    expect(mockedUploadLogoAction).not.toHaveBeenCalled()
  })

  it("téléverse le fichier sélectionné puis affiche un succès", async () => {
    mockedUploadLogoAction.mockResolvedValue({})
    const user = userEvent.setup()
    render(<LogoUploadForm hasLogo={false} logoVersion={0} />)

    const input = screen.getByLabelText(/fichier/i) as HTMLInputElement
    await user.upload(input, pngFile())
    await user.click(screen.getByRole("button", { name: /téléverser/i }))

    await waitFor(() => {
      expect(mockedUploadLogoAction).toHaveBeenCalledTimes(1)
    })
    const formData = mockedUploadLogoAction.mock.calls[0]?.[0]
    expect(formData).toBeInstanceOf(FormData)
    expect((formData?.get("logo") as File).name).toBe("logo.png")
    expect(mockToastSuccess).toHaveBeenCalledWith("Le logo a été enregistré.")
    expect(mockRefresh).toHaveBeenCalled()
  })

  it("affiche l'erreur retournée par l'action d'upload", async () => {
    mockedUploadLogoAction.mockResolvedValue({
      error: "Format de fichier non pris en charge (PNG, JPEG, WebP ou SVG uniquement).",
    })
    const user = userEvent.setup()
    render(<LogoUploadForm hasLogo={false} logoVersion={0} />)

    const input = screen.getByLabelText(/fichier/i) as HTMLInputElement
    await user.upload(input, pngFile())
    await user.click(screen.getByRole("button", { name: /téléverser/i }))

    const alerte = await screen.findByRole("alert")
    expect(alerte).toHaveTextContent(
      "Format de fichier non pris en charge (PNG, JPEG, WebP ou SVG uniquement).",
    )
    expect(mockToastSuccess).not.toHaveBeenCalled()
  })

  it("retire le logo puis affiche un succès", async () => {
    mockedRemoveLogoAction.mockResolvedValue({})
    const user = userEvent.setup()
    render(<LogoUploadForm hasLogo={true} logoVersion={42} />)

    await user.click(screen.getByRole("button", { name: /retirer le logo/i }))

    await waitFor(() => {
      expect(mockedRemoveLogoAction).toHaveBeenCalledTimes(1)
    })
    expect(mockToastSuccess).toHaveBeenCalledWith("Le logo a été retiré.")
    expect(mockRefresh).toHaveBeenCalled()
  })
})
