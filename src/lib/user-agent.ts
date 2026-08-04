// Dérive un libellé français lisible (« Chrome sur Windows ») à partir d'un
// user-agent brut, pour l'affichage des sessions actives (voir
// src/components/profile/active-sessions-card.tsx). Volontairement simple
// (pas de dépendance de parsing de user-agent) : couvre les navigateurs et
// systèmes les plus courants, se rabat sur des libellés génériques sinon.

function detectBrowser(userAgent: string): string {
  if (/edg\//i.test(userAgent)) return "Edge"
  if (/opr\/|opera/i.test(userAgent)) return "Opera"
  if (/firefox|fxios/i.test(userAgent)) return "Firefox"
  if (/crios|chrome/i.test(userAgent)) return "Chrome"
  if (/safari/i.test(userAgent)) return "Safari"
  return "Navigateur inconnu"
}

function detectOS(userAgent: string): string {
  if (/windows/i.test(userAgent)) return "Windows"
  // À vérifier avant "mac os" : les user-agents iOS contiennent la chaîne
  // « like Mac OS X » et seraient sinon détectés à tort comme macOS.
  if (/iphone|ipad|ipod/i.test(userAgent)) return "iOS"
  if (/android/i.test(userAgent)) return "Android"
  if (/mac os|macintosh/i.test(userAgent)) return "macOS"
  if (/linux/i.test(userAgent)) return "Linux"
  return "appareil inconnu"
}

export function describeUserAgent(userAgent: string | null | undefined): string {
  if (!userAgent || !userAgent.trim()) return "Appareil inconnu"

  return `${detectBrowser(userAgent)} sur ${detectOS(userAgent)}`
}
