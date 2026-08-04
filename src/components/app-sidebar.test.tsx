import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"

let pathname = "/tableau-de-bord"

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

beforeEach(() => {
  pathname = "/tableau-de-bord"
})

function renderSidebar(permissions: string[]) {
  return render(
    <SidebarProvider>
      <AppSidebar
        user={{ name: "Alex Caron", email: "alex@exemple.com" }}
        permissions={permissions}
        appName="Mon Application"
        hasLogo={false}
        logoVersion={0}
      />
    </SidebarProvider>,
  )
}

describe("AppSidebar", () => {
  it("affiche le nom de l'application configuré dans l'en-tête", () => {
    renderSidebar(["settings:update"])

    expect(screen.getByText("Mon Application")).toBeInTheDocument()
  })

  it("affiche toujours le lien Tableau de bord", () => {
    renderSidebar([])

    expect(screen.getByText("Tableau de bord")).toBeInTheDocument()
  })

  it("affiche le groupe Administration quand la permission settings:update est accordée", () => {
    renderSidebar(["settings:update"])

    expect(screen.getByText("Administration")).toBeInTheDocument()
  })

  it("déplie le sous-menu quand la route courante s'y trouve", () => {
    pathname = "/administration/general"
    renderSidebar(["settings:update"])

    expect(screen.getByText("Général")).toBeInTheDocument()
  })

  it("garde le sous-menu replié quand la route courante est ailleurs", () => {
    renderSidebar(["settings:update"])

    expect(screen.queryByText("Général")).not.toBeInTheDocument()
  })

  it("cache le groupe Administration sans aucune des permissions de ses entrées", () => {
    // Aucune des quatre permissions (user:read, role:read, settings:update,
    // audit:read) n'est accordée : le groupe entier ne doit pas s'afficher
    // plutôt que de proposer un lien menant à un « Accès refusé ».
    renderSidebar([])

    expect(screen.queryByText("Administration")).not.toBeInTheDocument()
  })

  it("affiche Journal quand audit:read est accordée", () => {
    pathname = "/administration/journal"
    renderSidebar(["audit:read"])

    expect(screen.getByText("Administration")).toBeInTheDocument()
    expect(screen.getByText("Journal")).toBeInTheDocument()
  })

  it("affiche Utilisateurs quand user:read est accordée", () => {
    pathname = "/administration/utilisateurs"
    renderSidebar(["user:read"])

    expect(screen.getByText("Administration")).toBeInTheDocument()
    expect(screen.getByText("Utilisateurs")).toBeInTheDocument()
  })

  it("affiche Rôles quand role:read est accordée", () => {
    pathname = "/administration/roles"
    renderSidebar(["role:read"])

    expect(screen.getByText("Administration")).toBeInTheDocument()
    expect(screen.getByText("Rôles")).toBeInTheDocument()
  })

  it("n'affiche que les entrées correspondant aux permissions accordées", () => {
    // user:read est accordée mais pas role:read ni settings:update : seule
    // l'entrée Utilisateurs doit apparaître dans le sous-menu.
    pathname = "/administration/utilisateurs"
    renderSidebar(["user:read"])

    expect(screen.getByText("Utilisateurs")).toBeInTheDocument()
    expect(screen.queryByText("Rôles")).not.toBeInTheDocument()
    expect(screen.queryByText("Général")).not.toBeInTheDocument()
  })
})
