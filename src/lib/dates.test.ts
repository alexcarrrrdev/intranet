import { describe, expect, it } from "vitest"

import {
  formatDayOfMonth,
  formatRelativeTime,
  formatShortDate,
  formatShortDateTime,
  formatShortMonth,
  formatTime,
} from "@/lib/dates"

describe("formatRelativeTime", () => {
  const now = new Date("2026-08-04T14:00:00")

  it("retourne « à l'instant » pour moins d'une minute", () => {
    expect(formatRelativeTime(new Date("2026-08-04T13:59:30"), now)).toBe(
      "à l'instant",
    )
  })

  it("retourne « à l'instant » pour une date future (horloge en avance)", () => {
    expect(formatRelativeTime(new Date("2026-08-04T14:00:10"), now)).toBe(
      "à l'instant",
    )
  })

  it("retourne des minutes pour moins d'une heure", () => {
    expect(formatRelativeTime(new Date("2026-08-04T13:55:00"), now)).toBe(
      "il y a 5 min",
    )
  })

  it("retourne des heures pour moins de 24 h", () => {
    expect(formatRelativeTime(new Date("2026-08-04T12:00:00"), now)).toBe(
      "il y a 2 h",
    )
  })

  it("retourne « hier » pour le jour civil précédent", () => {
    expect(formatRelativeTime(new Date("2026-08-03T09:00:00"), now)).toBe(
      "hier",
    )
  })

  it("retourne une date courte au-delà d'hier", () => {
    expect(formatRelativeTime(new Date("2026-07-20T09:00:00"), now)).toBe(
      formatShortDate(new Date("2026-07-20T09:00:00")),
    )
  })
})

describe("formatShortDate", () => {
  it("formate une date en fr-CA", () => {
    expect(formatShortDate(new Date("2026-08-04T14:30:00"))).toBe(
      "4 août 2026",
    )
  })
})

describe("formatTime", () => {
  it("formate une heure en fr-CA", () => {
    expect(formatTime(new Date("2026-08-04T14:30:00"))).toBe("14 h 30")
  })

  it("garde le zéro devant les minutes", () => {
    expect(formatTime(new Date("2026-08-04T09:05:00"))).toBe("9 h 05")
  })
})

describe("formatShortDateTime", () => {
  it("combine date et heure courtes", () => {
    expect(formatShortDateTime(new Date("2026-08-04T14:30:00"))).toBe(
      "4 août 2026 à 14 h 30",
    )
  })
})

describe("formatDayOfMonth / formatShortMonth", () => {
  it("retourne le jour et le mois abrégé séparément", () => {
    const date = new Date("2026-08-04T14:30:00")
    expect(formatDayOfMonth(date)).toBe("4")
    expect(formatShortMonth(date)).toBe("août")
  })
})
