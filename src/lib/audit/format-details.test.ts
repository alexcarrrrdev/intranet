import { describe, expect, it } from "vitest"

import { formatAuditDetails } from "@/lib/audit/format-details"

// Un cas par action qui produit un détail structuré (voir chaque site
// d'appel de recordAudit, src/lib/audit/audit.ts, pour la forme exacte de
// `details`), plus les cas défensifs (absent, malformé, action inconnue) —
// fonction pure, aucune base de données nécessaire.

describe("formatAuditDetails", () => {
  it("retourne un tableau vide quand details est absent", () => {
    expect(formatAuditDetails("user.update", null)).toEqual([])
    expect(formatAuditDetails("user.update", undefined)).toEqual([])
  })

  it("retourne un tableau vide pour une valeur malformée (pas un objet)", () => {
    expect(formatAuditDetails("user.update", "chaîne inattendue")).toEqual([])
    expect(formatAuditDetails("user.update", ["a", "b"])).toEqual([])
    expect(formatAuditDetails("user.update", 42)).toEqual([])
  })

  it("retourne un tableau vide pour une action sans rendu défini (ex. auth.login)", () => {
    expect(formatAuditDetails("auth.login", { anything: true })).toEqual([])
  })

  it("user.create : rôle accordé", () => {
    expect(formatAuditDetails("user.create", { role: "member" })).toEqual(["rôle : member"])
  })

  it("user.update : nom et rôle modifiés", () => {
    expect(
      formatAuditDetails("user.update", {
        name: { before: "Ancien nom", after: "Nouveau nom" },
        role: { before: "member", after: "admin" },
      }),
    ).toEqual([
      "nom : « Ancien nom » → « Nouveau nom »",
      "rôle : « member » → « admin »",
    ])
  })

  it("user.update : seul le nom a changé", () => {
    expect(
      formatAuditDetails("user.update", { name: { before: "A", after: "B" } }),
    ).toEqual(["nom : « A » → « B »"])
  })

  it("role.create : liste des permissions accordées", () => {
    expect(
      formatAuditDetails("role.create", { permissions: ["user:read", "settings:read"] }),
    ).toEqual(["permissions : user:read, settings:read"])
  })

  it("role.create : aucune permission accordée ne produit aucune ligne", () => {
    expect(formatAuditDetails("role.create", { permissions: [] })).toEqual([])
  })

  it("role.update : nom, description et permissions ajoutées/retirées", () => {
    expect(
      formatAuditDetails("role.update", {
        name: { before: "Support", after: "Support Client" },
        description: { before: null, after: "Équipe support" },
        permissionsAdded: ["user:read"],
        permissionsRemoved: ["settings:read"],
      }),
    ).toEqual([
      "nom : « Support » → « Support Client »",
      "description : « null » → « Équipe support »",
      "permissions +user:read −settings:read",
    ])
  })

  it("role.update : permissions inchangées ne produisent aucune ligne de permissions", () => {
    expect(
      formatAuditDetails("role.update", {
        permissionsAdded: [],
        permissionsRemoved: [],
      }),
    ).toEqual([])
  })

  it("settings.app_name.update : nom de l'application modifié", () => {
    expect(
      formatAuditDetails("settings.app_name.update", {
        appName: { before: "Admin Template", after: "Ma Compagnie" },
      }),
    ).toEqual(["nom de l'application : « Admin Template » → « Ma Compagnie »"])
  })

  it("settings.primary_color.update : couleur principale modifiée", () => {
    expect(
      formatAuditDetails("settings.primary_color.update", {
        primaryColor: { before: null, after: "#2563eb" },
      }),
    ).toEqual(["couleur principale : « null » → « #2563eb »"])
  })

  it("settings.primary_color.update : couleur principale remplacée", () => {
    expect(
      formatAuditDetails("settings.primary_color.update", {
        primaryColor: { before: "#2563eb", after: "#dc2626" },
      }),
    ).toEqual(["couleur principale : « #2563eb » → « #dc2626 »"])
  })

  it("settings.primary_color.delete : aucun détail rendu (comme settings.logo.delete)", () => {
    expect(formatAuditDetails("settings.primary_color.delete", { anything: true })).toEqual([])
  })

  it("settings.logo.update : type MIME et taille", () => {
    expect(
      formatAuditDetails("settings.logo.update", { mimeType: "image/png", size: 2048 }),
    ).toEqual(["logo : image/png, 2 Ko"])
  })

  it("settings.logo.update : taille sous 1 Ko affichée en octets", () => {
    expect(
      formatAuditDetails("settings.logo.update", { mimeType: "image/png", size: 512 }),
    ).toEqual(["logo : image/png, 512 o"])
  })

  it("auth.password.change : autres sessions révoquées", () => {
    expect(
      formatAuditDetails("auth.password.change", { revokedOtherSessions: true }),
    ).toEqual(["autres sessions révoquées"])
  })

  it("profile.name.update : nom modifié", () => {
    expect(
      formatAuditDetails("profile.name.update", { name: { before: "A", after: "B" } }),
    ).toEqual(["nom : « A » → « B »"])
  })

  it("session.revoke_others : nombre de sessions révoquées", () => {
    expect(formatAuditDetails("session.revoke_others", { revokedCount: 3 })).toEqual([
      "sessions révoquées : 3",
    ])
  })
})
