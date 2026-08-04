import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { DirectoryGrid, type DirectoryUser } from "@/components/annuaire/directory-grid"

const users: DirectoryUser[] = [
  { id: "u1", name: "Alex Caron", email: "alex@exemple.com", image: null, roleName: "Administrateur" },
  { id: "u2", name: "Sam Tremblay", email: "sam@exemple.com", image: null, roleName: "Membre" },
]

describe("DirectoryGrid", () => {
  it("affiche tous les utilisateurs par défaut", () => {
    render(<DirectoryGrid users={users} />)
    expect(screen.getByText("Alex Caron")).toBeInTheDocument()
    expect(screen.getByText("Sam Tremblay")).toBeInTheDocument()
  })

  it("filtre par nom lors d'une recherche", async () => {
    const user = userEvent.setup()
    render(<DirectoryGrid users={users} />)

    await user.type(screen.getByPlaceholderText(/rechercher/i), "sam")

    expect(screen.queryByText("Alex Caron")).not.toBeInTheDocument()
    expect(screen.getByText("Sam Tremblay")).toBeInTheDocument()
  })

  it("affiche un état vide quand aucun utilisateur ne correspond", async () => {
    const user = userEvent.setup()
    render(<DirectoryGrid users={users} />)

    await user.type(screen.getByPlaceholderText(/rechercher/i), "zzz")

    expect(screen.getByText(/aucun utilisateur ne correspond/i)).toBeInTheDocument()
  })

  it("affiche un état vide soigné quand la liste est vide", () => {
    render(<DirectoryGrid users={[]} />)
    expect(screen.getByText(/aucun utilisateur à afficher/i)).toBeInTheDocument()
  })
})
