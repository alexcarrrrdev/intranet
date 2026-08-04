import { describe, expect, it } from "vitest"

import {
  actionLabels,
  getAllPermissions,
  getPermissionsForRole,
  hasPermission,
  isValidPermission,
  requirePermission,
  resourceLabels,
  statement,
  type Resource,
} from "@/lib/auth/permissions"

// Ces tests couvrent la logique PURE du module (catalogue, libellés,
// helpers de chaînes de permission) et le court-circuit de l'administrateur
// — qui ne touche jamais la base de données (voir getPermissionsForRole) et
// peut donc être exercé ici en toute sécurité. La résolution réelle depuis
// `role_permission` (rôle "member", rôle inconnu, rôle personnalisé) est
// testée contre un vrai Postgres dans permissions.integration.test.ts.

describe("statement", () => {
  it("déclare les ressources et actions attendues", () => {
    // Garde-fou : si une ressource ou une action est ajoutée au catalogue
    // sans que ce test soit mis à jour, il échoue plutôt que de laisser une
    // nouvelle permission non couverte passer inaperçue.
    expect(Object.keys(statement).sort()).toEqual(["audit", "role", "settings", "user"])
    expect([...statement.user].sort()).toEqual(["create", "delete", "read", "update"])
    expect([...statement.settings].sort()).toEqual(["read", "update"])
    expect([...statement.role].sort()).toEqual(["create", "delete", "read", "update"])
    expect([...statement.audit].sort()).toEqual(["read"])
  })

  it("a un libellé français pour chaque ressource et chaque action du catalogue", () => {
    for (const resource of Object.keys(statement) as Resource[]) {
      expect(resourceLabels[resource], `resourceLabels.${resource}`).toBeTruthy()
      for (const action of statement[resource]) {
        expect(actionLabels[action], `actionLabels.${action}`).toBeTruthy()
      }
    }
  })
})

describe("getAllPermissions", () => {
  it("retourne une chaîne 'resource:action' pour chaque entrée du catalogue", () => {
    const all = getAllPermissions()

    let expectedSize = 0
    for (const resource of Object.keys(statement) as Resource[]) {
      for (const action of statement[resource]) {
        expect(all.has(`${resource}:${action}`)).toBe(true)
        expectedSize++
      }
    }
    expect(all.size).toBe(expectedSize)
  })
})

describe("isValidPermission", () => {
  it("accepte toute permission du catalogue", () => {
    expect(isValidPermission("user:create")).toBe(true)
    expect(isValidPermission("settings:read")).toBe(true)
    expect(isValidPermission("role:delete")).toBe(true)
  })

  it("refuse une chaîne qui n'est pas dans le catalogue", () => {
    expect(isValidPermission("user:archive")).toBe(false)
    expect(isValidPermission("invoice:create")).toBe(false)
    expect(isValidPermission("")).toBe(false)
  })
})

describe("getPermissionsForRole — court-circuit administrateur", () => {
  it("retourne l'intégralité du catalogue pour 'admin', sans lecture en base", async () => {
    const granted = await getPermissionsForRole("admin")

    expect(granted).toEqual(getAllPermissions())
  })

  it("retourne un ensemble vide pour un rôle absent (null ou undefined)", async () => {
    expect(await getPermissionsForRole(null)).toEqual(new Set())
    expect(await getPermissionsForRole(undefined)).toEqual(new Set())
  })
})

describe("hasPermission", () => {
  const admin = { role: "admin" }

  it("accorde à l'administrateur toutes les permissions du catalogue", async () => {
    expect(await hasPermission(admin, "user", "create")).toBe(true)
    expect(await hasPermission(admin, "user", "read")).toBe(true)
    expect(await hasPermission(admin, "user", "update")).toBe(true)
    expect(await hasPermission(admin, "user", "delete")).toBe(true)
    expect(await hasPermission(admin, "settings", "read")).toBe(true)
    expect(await hasPermission(admin, "settings", "update")).toBe(true)
    expect(await hasPermission(admin, "role", "create")).toBe(true)
    expect(await hasPermission(admin, "role", "delete")).toBe(true)
    expect(await hasPermission(admin, "audit", "read")).toBe(true)
  })

  it("retourne false pour un utilisateur absent (null ou undefined)", async () => {
    expect(await hasPermission(null, "user", "read")).toBe(false)
    expect(await hasPermission(undefined, "user", "read")).toBe(false)
  })
})

describe("requirePermission", () => {
  const admin = { role: "admin" }

  it("ne lance pas d'erreur quand la permission est accordée", async () => {
    await expect(requirePermission(admin, "user", "create")).resolves.toBeUndefined()
  })

  it("lance une erreur en français pour un utilisateur absent", async () => {
    await expect(requirePermission(null, "settings", "update")).rejects.toThrow(
      /permission refusée/i,
    )
  })
})
