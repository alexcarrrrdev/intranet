import { describe, expect, it } from "vitest"

import { formatIpAddress } from "@/lib/ip-address"

describe("formatIpAddress", () => {
  it("signale une adresse absente", () => {
    expect(formatIpAddress(null)).toBe("Adresse IP inconnue")
    expect(formatIpAddress(undefined)).toBe("Adresse IP inconnue")
    expect(formatIpAddress("  ")).toBe("Adresse IP inconnue")
  })

  it("remplace les adresses de bouclage IPv4", () => {
    expect(formatIpAddress("127.0.0.1")).toBe("Adresse locale")
    expect(formatIpAddress("0.0.0.0")).toBe("Adresse locale")
  })

  it("remplace les adresses IPv6 locales, y compris développées", () => {
    expect(formatIpAddress("::1")).toBe("Adresse locale")
    expect(formatIpAddress("::")).toBe("Adresse locale")
    expect(formatIpAddress("0:0:0:0:0:0:0:1")).toBe("Adresse locale")
    expect(
      formatIpAddress("0000:0000:0000:0000:0000:0000:0000:0000"),
    ).toBe("Adresse locale")
    expect(
      formatIpAddress("0000:0000:0000:0000:0000:0000:0000:0001"),
    ).toBe("Adresse locale")
  })

  it("laisse intactes les adresses réelles", () => {
    expect(formatIpAddress("24.201.45.9")).toBe("24.201.45.9")
    expect(formatIpAddress("2001:db8::1")).toBe("2001:db8::1")
    expect(formatIpAddress("2001:0db8:0000:0000:0000:0000:0000:1234")).toBe(
      "2001:0db8:0000:0000:0000:0000:0000:1234",
    )
  })
})
