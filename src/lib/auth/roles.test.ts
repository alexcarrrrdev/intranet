import { describe, expect, it } from "vitest"

import { createRole, slugify } from "@/lib/auth/roles"

// `slugify` est la seule logique pure de src/lib/auth/roles.ts (le reste
// parle à la base de données) — voir src/lib/auth/roles.integration.test.ts
// pour le CRUD complet des rôles.
//
// Exception ci-dessous (`createRole — message d'erreur du slug dérivé du
// nom`) : ces deux cas précis lancent leur erreur AVANT le premier appel à
// la base (voir `resolveNewRoleId`, appelée en tout début de `createRole`),
// donc testables ici sans Postgres — pas la peine de les dupliquer dans
// roles.integration.test.ts. `actorId` (premier paramètre, depuis l'ajout du
// journal d'audit — voir src/lib/audit/audit.ts) n'a donc pas besoin de
// correspondre à un utilisateur réel : une valeur arbitraire suffit, jamais
// utilisée avant l'erreur.

describe("slugify", () => {
  it("met en minuscules et remplace les espaces par des tirets", () => {
    expect(slugify("Support Client")).toBe("support-client")
  })

  it("retire les accents", () => {
    expect(slugify("Comptabilité Générale")).toBe("comptabilite-generale")
  })

  it("remplace toute suite de caractères non alphanumériques par un seul tiret", () => {
    expect(slugify("Ventes & Marketing !!!")).toBe("ventes-marketing")
  })

  it("retire les tirets en début et fin de chaîne", () => {
    expect(slugify("  -Support-  ")).toBe("support")
  })

  it("retourne une chaîne vide pour un nom sans caractère alphanumérique", () => {
    expect(slugify("!!!")).toBe("")
  })
})

describe("createRole — message d'erreur du slug dérivé du nom", () => {
  it("refuse un nom sans lettre ni chiffre avec un message orienté « nom », pas « identifiant »", async () => {
    // Aucun `id` fourni : le slug est DÉRIVÉ du nom (voir slugify ci-dessus)
    // — "!!!" en donne une chaîne vide, invalide. Le formulaire
    // /administration/roles n'expose plus de champ "identifiant" (voir le
    // commentaire de resolveNewRoleId dans src/lib/auth/roles.ts) : le
    // message ne doit donc parler que du nom.
    await expect(
      createRole("test-actor", { name: "!!!", permissions: [] }),
    ).rejects.toThrow("Le nom du rôle doit contenir au moins une lettre ou un chiffre.")
  })

  it("garde le message technique pour un identifiant explicite invalide (usage script/API)", async () => {
    await expect(
      createRole("test-actor", { id: "!!!", name: "Nom valide", permissions: [] }),
    ).rejects.toThrow(/identifiant de rôle invalide/i)
  })
})
