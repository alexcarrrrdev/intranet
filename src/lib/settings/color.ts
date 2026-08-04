/**
 * Petit module de calcul de couleurs, SANS aucune dépendance npm (voir
 * AGENTS.md/consignes de la tâche : aucune nouvelle dépendance autorisée
 * pour ce projet) — les formules ci-dessous sont les formules standard de
 * conversion RGB <-> HSL et de luminance relative WCAG, réimplémentées à la
 * main plutôt qu'empruntées à une bibliothèque de couleurs.
 *
 * Utilisé par la couleur principale personnalisable de l'application (voir
 * setPrimaryColor/clearPrimaryColor dans src/lib/settings/app-settings.ts,
 * la carte « Couleur principale » de /administration/general, et
 * l'injection côté serveur dans src/app/layout.tsx) : à partir d'une seule
 * couleur hexadécimale choisie par un administrateur, ce module calcule
 * tout ce qu'il faut pour l'appliquer de façon lisible et cohérente à
 * travers le thème clair ET sombre (voir buildThemeCssVariables plus bas).
 *
 * Fonction PURE de bout en bout (aucun accès base de données, aucun état) :
 * testable sans Postgres — voir color.test.ts.
 */

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i

/**
 * Valide strictement le format `#RRGGBB` (exactement 6 chiffres
 * hexadécimaux après le dièse, insensible à la casse). Rejette les formes
 * courtes (`#fff`), avec canal alpha (`#rrggbbaa`), sans dièse, ou toute
 * chaîne qui n'est pas un hex color — utilisé à la fois par le schéma Zod
 * (voir src/lib/settings/schemas.ts) et implicitement par toutes les
 * fonctions ci-dessous, qui supposent une entrée déjà validée par cet appel.
 */
export function isValidHexColor(value: string): boolean {
  return HEX_COLOR_PATTERN.test(value)
}

export type Rgb = { r: number; g: number; b: number }
export type Hsl = { h: number; s: number; l: number }

/**
 * Décompose une couleur `#RRGGBB` en ses composantes rouge/vert/bleu
 * (0-255 chacune). Ne revalide pas le format en entrée (voir
 * isValidHexColor ci-dessus) : suppose un appelant qui l'a déjà fait.
 */
export function hexToRgb(hex: string): Rgb {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  }
}

/**
 * Conversion RGB (0-255 par canal) → HSL (teinte en degrés 0-360,
 * saturation et luminosité en pourcentage 0-100) — formule standard (voir
 * par ex. https://www.w3.org/TR/css-color-3/#hsl-color, « converting RGB to
 * HSL »).
 */
export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rNorm = r / 255
  const gNorm = g / 255
  const bNorm = b / 255
  const max = Math.max(rNorm, gNorm, bNorm)
  const min = Math.min(rNorm, gNorm, bNorm)
  const delta = max - min

  const l = (max + min) / 2

  if (delta === 0) {
    // Couleur achromatique (gris, y compris noir/blanc) : teinte et
    // saturation ne sont pas définies, conventionnellement mises à 0.
    return { h: 0, s: 0, l: l * 100 }
  }

  const s = delta / (1 - Math.abs(2 * l - 1))

  let h: number
  switch (max) {
    case rNorm:
      h = ((gNorm - bNorm) / delta) % 6
      break
    case gNorm:
      h = (bNorm - rNorm) / delta + 2
      break
    default:
      h = (rNorm - gNorm) / delta + 4
  }
  h *= 60
  if (h < 0) h += 360

  return { h, s: s * 100, l: l * 100 }
}

/**
 * Conversion inverse HSL → RGB (formule standard, symétrique de
 * rgbToHsl) — nécessaire en interne pour reconvertir la variante « mode
 * sombre » d'une couleur (voir darkVariantHsl plus bas) en composantes RGB,
 * afin de calculer sa couleur de texte lisible sans repasser par une chaîne
 * hexadécimale.
 */
function hslToRgb({ h, s, l }: Hsl): Rgb {
  const sNorm = s / 100
  const lNorm = l / 100
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm
  const hPrime = h / 60
  const x = c * (1 - Math.abs((hPrime % 2) - 1))
  const m = lNorm - c / 2

  let rgb1: [number, number, number]
  if (hPrime < 1) rgb1 = [c, x, 0]
  else if (hPrime < 2) rgb1 = [x, c, 0]
  else if (hPrime < 3) rgb1 = [0, c, x]
  else if (hPrime < 4) rgb1 = [0, x, c]
  else if (hPrime < 5) rgb1 = [x, 0, c]
  else rgb1 = [c, 0, x]

  return {
    r: (rgb1[0] + m) * 255,
    g: (rgb1[1] + m) * 255,
    b: (rgb1[2] + m) * 255,
  }
}

// Valeurs de texte « presque blanc » / « presque noir » DÉJÀ utilisées dans
// src/app/globals.css pour --primary-foreground (respectivement celle du
// thème clair par défaut — texte sur le --primary sombre par défaut — et
// celle du thème sombre par défaut — texte sur le --primary clair par
// défaut). Les réutiliser ici, plutôt que du blanc/noir pur, garde une
// cohérence visuelle avec le reste du thème, où aucune couleur n'est
// jamais à 100% de luminosité OKLCH.
const FOREGROUND_LIGHT = "oklch(0.985 0 0)" // quasi blanc — texte sur fond de marque sombre
const FOREGROUND_DARK = "oklch(0.205 0 0)" // quasi noir — texte sur fond de marque clair

/**
 * Luminance relative au sens WCAG 2.x (voir
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance) : chaque canal RGB
 * est d'abord « linéarisé » avant d'être pondéré, car l'espace sRGB standard
 * n'est pas linéaire vis-à-vis de la lumière perçue. C'est cette étape de
 * linéarisation qui distingue ce calcul d'une simple moyenne des canaux —
 * une moyenne donnerait de mauvais résultats de lisibilité, notamment pour
 * des couleurs très saturées (ex. un bleu ou un rouge purs, dont la
 * luminance perçue est bien plus basse que leur moyenne RGB ne le suggère).
 */
function relativeLuminance({ r, g, b }: Rgb): number {
  const linearize = (channel255: number) => {
    const c = channel255 / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

/**
 * Choisit, entre FOREGROUND_LIGHT et FOREGROUND_DARK, la couleur de texte la
 * plus lisible sur un fond de luminance `luminance` donnée — en comparant le
 * ratio de contraste WCAG obtenu avec chacune des deux options et en
 * retenant celle qui l'emporte, plutôt que de fixer un seuil arbitraire.
 * (Le seuil « magique » ≈ 0,179 parfois cité pour ce genre de décision n'est
 * en fait que le point où ces deux ratios s'égalisent — comparer les deux
 * ratios directement revient au même résultat tout en explicitant le
 * raisonnement.)
 */
function foregroundForLuminance(luminance: number): string {
  const contrastWithWhite = 1.05 / (luminance + 0.05)
  const contrastWithBlack = (luminance + 0.05) / 0.05
  return contrastWithBlack >= contrastWithWhite ? FOREGROUND_DARK : FOREGROUND_LIGHT
}

/**
 * Détermine la couleur de texte lisible (quasi blanc ou quasi noir, voir
 * FOREGROUND_LIGHT/FOREGROUND_DARK) à appliquer sur un fond de la couleur
 * `hex` donnée. Utilisée pour `--primary-foreground` /
 * `--sidebar-primary-foreground` en mode clair (voir
 * buildThemeCssVariables) — ex. un jaune (#facc15) donne un texte sombre,
 * un bleu marine (#1e3a8a) donne un texte clair.
 */
export function readableForeground(hex: string): string {
  return foregroundForLuminance(relativeLuminance(hexToRgb(hex)))
}

/** Même calcul que readableForeground, mais à partir de composantes HSL déjà
 * en main (voir buildThemeCssVariables, qui l'utilise pour la variante mode
 * sombre sans repasser par une chaîne hexadécimale). */
function readableForegroundForHsl(hsl: Hsl): string {
  return foregroundForLuminance(relativeLuminance(hslToRgb(hsl)))
}

// Plancher de luminosité (pourcentage HSL) appliqué en mode sombre (voir
// darkVariantHsl/darkModeVariant ci-dessous) : sous ce seuil, une couleur de
// marque sombre (ex. un bleu marine) se fondrait presque dans le fond sombre
// de l'application (--background: oklch(0.145 0 0), voir globals.css) et
// deviendrait difficile à distinguer, en particulier pour l'élément actif de
// la barre latérale. 55% est choisi empiriquement : assez haut pour rester
// nettement visible sur un fond sombre, assez bas pour ne rien changer à une
// couleur déjà claire.
const DARK_MODE_MIN_LIGHTNESS = 55

function formatHsl({ h, s, l }: Hsl): string {
  return `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`
}

/**
 * Calcule les composantes HSL de la variante « mode sombre » d'une couleur :
 * même teinte et saturation, luminosité relevée à DARK_MODE_MIN_LIGHTNESS au
 * minimum (jamais abaissée : une couleur déjà claire n'est donc pas
 * modifiée). Extrait de darkModeVariant pour être réutilisé par
 * buildThemeCssVariables, qui a aussi besoin de calculer le texte lisible
 * associé (voir readableForegroundForHsl) sans reformater/reparser une
 * chaîne CSS.
 */
function darkVariantHsl(hex: string): Hsl {
  const hsl = rgbToHsl(hexToRgb(hex))
  return { h: hsl.h, s: hsl.s, l: Math.max(hsl.l, DARK_MODE_MIN_LIGHTNESS) }
}

// ---------------------------------------------------------------------------
// Teinte pastel de l'élément actif de la barre latérale
// ---------------------------------------------------------------------------
// `--sidebar-accent` colore le fond de l'élément de navigation actif ET le
// survol des autres éléments (voir `data-active:bg-sidebar-accent` et
// `hover:bg-sidebar-accent` dans src/components/ui/sidebar.tsx). Lui donner
// la couleur de marque PLEINE produirait un bloc saturé très lourd — le
// patron classique est un fond en TEINTE PASTEL de la couleur (même teinte,
// luminosité très haute en clair / très basse en sombre), avec le texte dans
// une déclinaison foncée (clair) ou claire (sombre) de la même couleur.
const SIDEBAR_TINT_LIGHTNESS_LIGHT = 92
const SIDEBAR_TINT_TEXT_MAX_LIGHTNESS_LIGHT = 35
const SIDEBAR_TINT_LIGHTNESS_DARK = 26
const SIDEBAR_TINT_TEXT_MIN_LIGHTNESS_DARK = 85

// Ratio de contraste WCAG minimal (texte normal, niveau AA) entre le fond
// pastel et son texte coloré : si la paire calculée descend en dessous, on
// retombe sur le quasi-noir/quasi-blanc neutres plutôt que de sacrifier la
// lisibilité à l'esthétique.
const MIN_TINT_TEXT_CONTRAST = 4.5

/** Ratio de contraste WCAG entre deux luminances relatives (ordre libre). */
export function contrastRatio(luminanceA: number, luminanceB: number): number {
  const [darker, lighter] = [luminanceA, luminanceB].sort((a, b) => a - b)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Calcule la paire fond pastel / texte coloré de l'élément actif de la barre
 * latérale, pour un mode donné. Si le texte coloré ne contraste pas assez
 * avec son fond pastel (MIN_TINT_TEXT_CONTRAST), il est remplacé par le
 * neutre lisible correspondant (FOREGROUND_DARK en clair, FOREGROUND_LIGHT
 * en sombre).
 */
function sidebarTintPair(
  hex: string,
  mode: "light" | "dark",
): { accent: string; accentForeground: string } {
  const { h, s, l } = rgbToHsl(hexToRgb(hex))

  const tint: Hsl =
    mode === "light"
      ? { h, s, l: SIDEBAR_TINT_LIGHTNESS_LIGHT }
      : { h, s, l: SIDEBAR_TINT_LIGHTNESS_DARK }
  const text: Hsl =
    mode === "light"
      ? { h, s, l: Math.min(l, SIDEBAR_TINT_TEXT_MAX_LIGHTNESS_LIGHT) }
      : { h, s, l: Math.max(l, SIDEBAR_TINT_TEXT_MIN_LIGHTNESS_DARK) }

  const ratio = contrastRatio(
    relativeLuminance(hslToRgb(tint)),
    relativeLuminance(hslToRgb(text)),
  )
  const accentForeground =
    ratio >= MIN_TINT_TEXT_CONTRAST
      ? formatHsl(text)
      : mode === "light"
        ? FOREGROUND_DARK
        : FOREGROUND_LIGHT

  return { accent: formatHsl(tint), accentForeground }
}

/**
 * Calcule la variante d'une couleur adaptée au mode sombre : même teinte et
 * saturation que `hex`, mais luminosité relevée à DARK_MODE_MIN_LIGHTNESS au
 * minimum pour rester visible sur un fond sombre. Si la couleur est déjà
 * assez claire, sa luminosité n'est pas modifiée.
 *
 * Retourne une chaîne CSS `hsl(...)` (syntaxe moderne, espaces plutôt que
 * virgules — cohérent avec la syntaxe `oklch(...)` déjà utilisée dans
 * globals.css) plutôt qu'un hex : c'est la forme la plus directe à produire
 * depuis des composantes HSL déjà calculées, sans aller-retour HSL -> RGB ->
 * hex purement pour le formatage.
 */
export function darkModeVariant(hex: string): string {
  return formatHsl(darkVariantHsl(hex))
}

// Une des deux moitiés (clair OU sombre) du résultat de
// buildThemeCssVariables : un jeu de surcharges de variables CSS, prêt à
// être sérialisé dans une règle `:root { ... }` ou `.dark { ... }` (voir son
// utilisation dans src/app/layout.tsx).
export type ThemeVariableSet = {
  "--primary": string
  "--primary-foreground": string
  "--ring": string
  "--sidebar-primary": string
  "--sidebar-primary-foreground": string
  "--sidebar-ring": string
  "--sidebar-accent": string
  "--sidebar-accent-foreground": string
}

export type ThemeCssVariables = {
  light: ThemeVariableSet
  dark: ThemeVariableSet
}

/**
 * Calcule les surcharges de variables CSS de thème (voir src/app/globals.css
 * pour les valeurs par défaut qu'elles remplacent) correspondant à une
 * couleur principale personnalisée — voir son utilisation dans
 * src/app/layout.tsx, qui sérialise ce résultat dans un <style> rendu côté
 * serveur.
 *
 * Variables surchargées, dupliquées clair/sombre :
 *   - `--primary` / `--primary-foreground` : couleur des boutons/éléments
 *     "primaires" (voir buttonVariants dans src/components/ui/button.tsx) ;
 *   - `--ring` : anneau de focus, assorti à la couleur de marque plutôt que
 *     laissé au gris neutre par défaut ;
 *   - `--sidebar-primary` / `--sidebar-primary-foreground` /
 *     `--sidebar-ring` : équivalents conventionnels (nommage shadcn/ui) pour
 *     la barre latérale ;
 *   - `--sidebar-accent` / `--sidebar-accent-foreground` : c'est en réalité
 *     CETTE paire qui pilote l'élément de navigation actif/survolé dans CE
 *     projet (voir `data-active:bg-sidebar-accent` dans
 *     src/components/ui/sidebar.tsx — un composant écrit à la main pour ce
 *     template, PAS le fichier généré standard de shadcn/ui, où
 *     `--sidebar-primary` aurait normalement ce rôle). `--sidebar-primary`
 *     ci-dessus n'a donc, à l'heure actuelle, AUCUN effet visuel dans
 *     l'interface (aucune classe `bg-sidebar-primary` n'est utilisée nulle
 *     part — vérifié) ; il reste calculé et exposé pour rester cohérent
 *     avec le nommage shadcn/ui standard et pour ne rien casser si un futur
 *     composant venait à l'utiliser. C'est `--sidebar-accent` qu'il faut
 *     surcharger pour que « l'élément actif de la barre latérale suit la
 *     couleur choisie » soit réellement vrai à l'écran. Contrairement aux
 *     autres variables, cette paire ne reçoit PAS la couleur pleine mais sa
 *     TEINTE PASTEL (fond très clair en mode clair / très sombre en mode
 *     sombre, texte dans la couleur elle-même) — voir sidebarTintPair : la
 *     couleur pleine sur l'élément actif ET le survol produirait des blocs
 *     saturés visuellement très lourds.
 *
 * Dans le thème PAR DÉFAUT (globals.css), `--ring` et `--sidebar-ring` sont
 * déjà la MÊME valeur littérale dans les deux modes — cette fonction
 * respecte donc simplement cette cohérence existante en leur donnant
 * toujours la même couleur calculée. `--primary` et `--sidebar-primary`,
 * eux, sont identiques par défaut en mode clair, mais PAS en mode sombre (où
 * `--sidebar-primary` par défaut est un bleu propre à la barre latérale,
 * différent de `--primary`). Ce module s'aligne volontairement sur la
 * cohérence du mode clair plutôt que sur cette divergence du mode sombre :
 * le but même de la couleur principale personnalisée est qu'une seule
 * couleur de marque se retrouve identique sur les boutons ET la barre
 * latérale, dans les deux modes.
 */
export function buildThemeCssVariables(hex: string): ThemeCssVariables {
  const foregroundLight = readableForeground(hex)
  const darkHsl = darkVariantHsl(hex)
  const darkColor = formatHsl(darkHsl)
  const foregroundDark = readableForegroundForHsl(darkHsl)
  // L'élément actif (et le survol) de la barre latérale : teinte pastel de
  // la couleur plutôt que la couleur pleine — voir sidebarTintPair.
  const tintLight = sidebarTintPair(hex, "light")
  const tintDark = sidebarTintPair(hex, "dark")

  return {
    light: {
      "--primary": hex,
      "--primary-foreground": foregroundLight,
      "--ring": hex,
      "--sidebar-primary": hex,
      "--sidebar-primary-foreground": foregroundLight,
      "--sidebar-ring": hex,
      "--sidebar-accent": tintLight.accent,
      "--sidebar-accent-foreground": tintLight.accentForeground,
    },
    dark: {
      "--primary": darkColor,
      "--primary-foreground": foregroundDark,
      "--ring": darkColor,
      "--sidebar-primary": darkColor,
      "--sidebar-primary-foreground": foregroundDark,
      "--sidebar-ring": darkColor,
      "--sidebar-accent": tintDark.accent,
      "--sidebar-accent-foreground": tintDark.accentForeground,
    },
  }
}
