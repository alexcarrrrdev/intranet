import { describe, expect, it } from "vitest"

import { describeUserAgent } from "@/lib/user-agent"

describe("describeUserAgent", () => {
  it("retourne un libellé générique quand le user-agent est absent", () => {
    expect(describeUserAgent(null)).toBe("Appareil inconnu")
    expect(describeUserAgent(undefined)).toBe("Appareil inconnu")
    expect(describeUserAgent("")).toBe("Appareil inconnu")
  })

  it("détecte Chrome sur Windows", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    expect(describeUserAgent(ua)).toBe("Chrome sur Windows")
  })

  it("détecte Safari sur macOS", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
    expect(describeUserAgent(ua)).toBe("Safari sur macOS")
  })

  it("détecte Firefox sur Linux", () => {
    const ua = "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0"
    expect(describeUserAgent(ua)).toBe("Firefox sur Linux")
  })

  it("détecte Safari sur iOS", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    expect(describeUserAgent(ua)).toBe("Safari sur iOS")
  })

  it("détecte Chrome sur Android", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
    expect(describeUserAgent(ua)).toBe("Chrome sur Android")
  })

  it("se rabat sur des libellés génériques pour un user-agent inconnu", () => {
    expect(describeUserAgent("un-agent-inconnu")).toBe(
      "Navigateur inconnu sur appareil inconnu",
    )
  })
})
