import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ThemeSelector } from "@/components/settings/theme-selector"

const mockSetTheme = vi.fn()
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: mockSetTheme }),
}))

beforeEach(() => {
  mockSetTheme.mockReset()
})

describe("ThemeSelector", () => {
  it("affiche un sélecteur de thème étiqueté", () => {
    render(<ThemeSelector />)

    expect(screen.getByText("Thème")).toBeInTheDocument()
    expect(screen.getByRole("combobox")).toBeInTheDocument()
  })

  it("propose les options Clair, Sombre et Système", async () => {
    const user = userEvent.setup()
    render(<ThemeSelector />)

    await user.click(screen.getByRole("combobox"))

    expect(
      await screen.findByRole("option", { name: "Clair" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Sombre" })).toBeInTheDocument()
    expect(
      screen.getByRole("option", { name: "Système" }),
    ).toBeInTheDocument()
  })

  it("appelle setTheme avec la valeur choisie", async () => {
    const user = userEvent.setup()
    render(<ThemeSelector />)

    await user.click(screen.getByRole("combobox"))
    await user.click(await screen.findByRole("option", { name: "Sombre" }))

    // Le Select de Base UI transmet un second argument (détails de
    // l'événement) à onValueChange, ignoré par next-themes' setTheme : on
    // ne vérifie donc que le premier argument.
    expect(mockSetTheme).toHaveBeenCalled()
    expect(mockSetTheme.mock.calls[0]?.[0]).toBe("dark")
  })
})
