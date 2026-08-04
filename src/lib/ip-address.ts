// Mise en forme de l'adresse IP d'une session pour l'affichage.
//
// En développement (et derrière certains proxys), l'adresse remontée est une
// adresse de bouclage ou l'adresse IPv6 « non spécifiée », qui s'affiche sous
// la forme peu lisible « 0000:0000:0000:0000:0000:0000:0000:0000 ». On la
// remplace par un libellé compréhensible plutôt que de l'afficher telle
// quelle.

const LOCAL_IPV4 = new Set(["127.0.0.1", "0.0.0.0", "localhost"])

// Vrai pour "::", "::1" et toutes leurs formes développées (groupes de zéros).
function isLocalIpv6(value: string): boolean {
  if (!value.includes(":")) return false

  const groups = value.split(":").filter((group) => group !== "")
  if (groups.length === 0) return true

  const isZero = (group: string) => /^0+$/.test(group)
  if (groups.every(isZero)) return true

  const last = groups[groups.length - 1]
  return groups.slice(0, -1).every(isZero) && /^0*1$/.test(last)
}

export function formatIpAddress(ip: string | null | undefined): string {
  const value = ip?.trim()
  if (!value) return "Adresse IP inconnue"
  if (LOCAL_IPV4.has(value) || isLocalIpv6(value)) return "Adresse locale"
  return value
}
