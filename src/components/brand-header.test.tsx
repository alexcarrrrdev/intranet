import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { BrandHeader } from "@/components/brand-header"

// BrandHeader est un composant serveur asynchrone : hors du rendu complet
// de Next.js, on peut l'invoquer directement comme une fonction async et
// rendre le JSX résolu avec Testing Library (voir
// https://react.dev/reference/rsc/server-components, un composant serveur
// n'est jamais qu'une fonction async qui renvoie du JSX). L'accès aux
// paramètres de l'application (src/lib/settings/app-settings.ts, qui lit
// Postgres) est simulé avec vi.mock : ce test ne touche pas à la base.
const mockGetAppSettingsSummary = vi.fn()
vi.mock("@/lib/settings/app-settings", () => ({
  getAppSettingsSummary: () => mockGetAppSettingsSummary(),
}))

// BrandHeader appelle `connection()` (voir son commentaire) pour forcer un
// rendu dynamique — cette API lance une erreur hors d'une vraie requête
// Next.js (ce que ce test n'est pas), on la simule donc en no-op.
vi.mock("next/server", () => ({
  connection: () => Promise.resolve(),
}))

describe("BrandHeader", () => {
  it("affiche le nom de l'application et l'icône par défaut quand aucun logo n'est configuré", async () => {
    mockGetAppSettingsSummary.mockResolvedValue({
      appName: "Mon Application",
      hasLogo: false,
      logoVersion: 0,
    })

    const { container } = render(await BrandHeader())

    expect(screen.getByText("Mon Application")).toBeInTheDocument()
    expect(container.querySelector("svg")).toBeInTheDocument()
    expect(container.querySelector("img")).not.toBeInTheDocument()
  })

  it("affiche une image de logo avec une URL versionnée quand un logo est configuré", async () => {
    mockGetAppSettingsSummary.mockResolvedValue({
      appName: "Acme Corp",
      hasLogo: true,
      logoVersion: 1_753_920_000_000,
    })

    const { container } = render(await BrandHeader())

    expect(screen.getByText("Acme Corp")).toBeInTheDocument()
    const img = container.querySelector("img")
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute("src", "/logo?v=1753920000000")
    expect(container.querySelector("svg")).not.toBeInTheDocument()
  })
})
