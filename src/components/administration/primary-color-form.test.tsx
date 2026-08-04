import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  resetPrimaryColorAction,
  updatePrimaryColorAction,
} from "@/app/actions/app-settings"
import { PrimaryColorForm } from "@/components/administration/primary-color-form"

vi.mock("@/app/actions/app-settings", () => ({
  updatePrimaryColorAction: vi.fn(),
  resetPrimaryColorAction: vi.fn(),
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

const mockedUpdatePrimaryColorAction = vi.mocked(updatePrimaryColorAction)
const mockedResetPrimaryColorAction = vi.mocked(resetPrimaryColorAction)

beforeEach(() => {
  mockedUpdatePrimaryColorAction.mockReset()
  mockedResetPrimaryColorAction.mockReset()
  mockRefresh.mockReset()
  mockToastSuccess.mockReset()
})

describe("PrimaryColorForm", () => {
  it("affiche les six suggestions de couleur", () => {
    render(<PrimaryColorForm defaultPrimaryColor={null} />)

    for (const label of ["Noir (par défaut)", "Bleu", "Vert", "Violet", "Orange", "Rouge"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument()
    }
  })

  it("n'affiche pas le bouton Réinitialiser quand aucune couleur personnalisée n'est enregistrée", () => {
    render(<PrimaryColorForm defaultPrimaryColor={null} />)

    expect(
      screen.queryByRole("button", { name: /réinitialiser/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(/aucune couleur personnalisée/i),
    ).toBeInTheDocument()
  })

  it("affiche le bouton Réinitialiser et la couleur actuelle quand une couleur est enregistrée", () => {
    render(<PrimaryColorForm defaultPrimaryColor="#2563eb" />)

    expect(
      screen.getByRole("button", { name: /réinitialiser/i }),
    ).toBeInTheDocument()
    expect(screen.getAllByText("#2563eb").length).toBeGreaterThan(0)
  })

  it("sélectionne un preset puis soumet la couleur choisie", async () => {
    mockedUpdatePrimaryColorAction.mockResolvedValue({})
    const user = userEvent.setup()
    render(<PrimaryColorForm defaultPrimaryColor={null} />)

    await user.click(screen.getByRole("button", { name: "Bleu" }))
    await user.click(screen.getByRole("button", { name: /enregistrer/i }))

    await waitFor(() => {
      expect(mockedUpdatePrimaryColorAction).toHaveBeenCalledTimes(1)
    })
    expect(mockedUpdatePrimaryColorAction).toHaveBeenCalledWith({
      primaryColor: "#2563eb",
    })
    expect(mockToastSuccess).toHaveBeenCalledWith(
      "La couleur principale a été enregistrée.",
    )
    expect(mockRefresh).toHaveBeenCalled()
  })

  it("affiche l'erreur retournée par le serveur lors de l'enregistrement", async () => {
    mockedUpdatePrimaryColorAction.mockResolvedValue({
      error: "Vous n'avez pas la permission de modifier ces paramètres.",
    })
    const user = userEvent.setup()
    render(<PrimaryColorForm defaultPrimaryColor={null} />)

    await user.click(screen.getByRole("button", { name: /enregistrer/i }))

    const alerte = await screen.findByRole("alert")
    expect(alerte).toHaveTextContent(
      "Vous n'avez pas la permission de modifier ces paramètres.",
    )
    expect(mockToastSuccess).not.toHaveBeenCalled()
  })

  it("réinitialise la couleur puis affiche un succès", async () => {
    mockedResetPrimaryColorAction.mockResolvedValue({})
    const user = userEvent.setup()
    render(<PrimaryColorForm defaultPrimaryColor="#2563eb" />)

    await user.click(screen.getByRole("button", { name: /réinitialiser/i }))

    await waitFor(() => {
      expect(mockedResetPrimaryColorAction).toHaveBeenCalledTimes(1)
    })
    expect(mockToastSuccess).toHaveBeenCalledWith(
      "La couleur principale a été réinitialisée.",
    )
    expect(mockRefresh).toHaveBeenCalled()
  })

  it("affiche l'erreur retournée par le serveur lors de la réinitialisation", async () => {
    mockedResetPrimaryColorAction.mockResolvedValue({
      error: "Une erreur est survenue lors de la réinitialisation de la couleur.",
    })
    const user = userEvent.setup()
    render(<PrimaryColorForm defaultPrimaryColor="#2563eb" />)

    await user.click(screen.getByRole("button", { name: /réinitialiser/i }))

    const alerte = await screen.findByRole("alert")
    expect(alerte).toHaveTextContent(
      "Une erreur est survenue lors de la réinitialisation de la couleur.",
    )
    expect(mockToastSuccess).not.toHaveBeenCalled()
  })
})
