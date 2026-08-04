import { afterEach, describe, expect, it, vi } from "vitest"

import { sendEmail } from "@/lib/email"

// EMAIL_PROVIDER_API_KEY n'est pas défini par défaut dans l'environnement de
// test (le project "node" ne charge pas .env) : on le sauvegarde quand même
// par prudence, pour ne rien laisser fuiter d'un test à l'autre.
const originalApiKey = process.env.EMAIL_PROVIDER_API_KEY

afterEach(() => {
  if (originalApiKey === undefined) {
    delete process.env.EMAIL_PROVIDER_API_KEY
  } else {
    process.env.EMAIL_PROVIDER_API_KEY = originalApiKey
  }
  vi.restoreAllMocks()
})

describe("sendEmail", () => {
  it("affiche le message dans la console quand aucun fournisseur n'est configuré", async () => {
    delete process.env.EMAIL_PROVIDER_API_KEY
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})

    await expect(
      sendEmail({
        to: "destinataire@exemple.com",
        subject: "Sujet du courriel",
        text: "Corps du courriel",
      }),
    ).resolves.toBeUndefined()

    const loggedLines = logSpy.mock.calls
      .map((call) => call.join(" "))
      .join("\n")
    expect(loggedLines).toContain("destinataire@exemple.com")
    expect(loggedLines).toContain("Sujet du courriel")
    expect(loggedLines).toContain("Corps du courriel")
  })

  it("lance l'erreur « non implémenté » quand un fournisseur est configuré", async () => {
    process.env.EMAIL_PROVIDER_API_KEY = "fake-key"

    await expect(
      sendEmail({
        to: "destinataire@exemple.com",
        subject: "Sujet",
        text: "Corps",
      }),
    ).rejects.toThrow(/aucune intégration n.est implémentée/i)
  })
})
