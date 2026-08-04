import { describe, expect, it, vi } from "vitest"

import { AUDIT_ACTIONS, recordAudit, type AuditAction, type AuditExecutor } from "@/lib/audit/audit"

// Tests unitaires (sans base de données) de la seule logique pure de
// src/lib/audit/audit.ts : la validation de `recordAudit` contre le
// catalogue AUDIT_ACTIONS. `resolveActorLabel`/`listAuditEntries`/
// `listDistinctActors` parlent toutes à Postgres et sont donc couvertes par
// src/lib/audit/audit.integration.test.ts.
//
// `recordAudit` prend un exécuteur Drizzle (`db` ou une transaction) —
// on le simule ici par un faux objet qui n'implémente que `.insert().values()`,
// suffisant pour observer SI une écriture a été tentée, sans toucher Postgres.

function createFakeExecutor() {
  const values = vi.fn().mockResolvedValue(undefined)
  const insert = vi.fn().mockReturnValue({ values })
  return { fake: { insert } as unknown as AuditExecutor, insert, values }
}

describe("AUDIT_ACTIONS", () => {
  it("n'associe que des libellés français non vides à chaque action", () => {
    for (const [action, label] of Object.entries(AUDIT_ACTIONS)) {
      expect(typeof label).toBe("string")
      expect(label.trim().length).toBeGreaterThan(0)
      expect(action.trim().length).toBeGreaterThan(0)
    }
  })
})

describe("recordAudit — validation du catalogue", () => {
  it("accepte une action connue du catalogue et écrit une rangée", async () => {
    const { fake, insert, values } = createFakeExecutor()

    await recordAudit(fake, {
      actorId: "user-1",
      actorLabel: "Alex Caron (alex@exemple.com)",
      action: "user.create",
      targetType: "user",
      targetId: "user-2",
      targetLabel: "Nouvel utilisateur (nouvel@exemple.com)",
      details: { role: "member" },
    })

    expect(insert).toHaveBeenCalledTimes(1)
    expect(values).toHaveBeenCalledTimes(1)
    const written = values.mock.calls[0]?.[0]
    expect(written).toMatchObject({
      actorId: "user-1",
      action: "user.create",
      targetLabel: "Nouvel utilisateur (nouvel@exemple.com)",
    })
    expect(typeof written.id).toBe("string")
    expect(written.id.length).toBeGreaterThan(0)
  })

  it("refuse une clé d'action absente du catalogue (contournement du typage) et n'écrit rien", async () => {
    const { fake, insert } = createFakeExecutor()

    await expect(
      recordAudit(fake, {
        actorId: null,
        actorLabel: "Système",
        // Contourne volontairement le typage TypeScript (`as AuditAction`),
        // pour prouver que la garde est bien à l'EXÉCUTION — un futur site
        // d'appel qui écrirait une clé inconnue par erreur (faute de frappe,
        // constante mal renommée) doit échouer bruyamment, pas être
        // silencieusement acceptée dans le journal.
        action: "user.frobnicate" as AuditAction,
        details: null,
      }),
    ).rejects.toThrow(/action d'audit inconnue/i)

    expect(insert).not.toHaveBeenCalled()
  })

  it("applique les valeurs par défaut (targetLabel vide, details/targetType/targetId nuls)", async () => {
    const { fake, values } = createFakeExecutor()

    await recordAudit(fake, {
      actorId: null,
      actorLabel: "Système",
      action: "auth.login",
    })

    const written = values.mock.calls[0]?.[0]
    expect(written).toMatchObject({
      actorId: null,
      targetType: null,
      targetId: null,
      targetLabel: "",
      details: null,
    })
  })
})
