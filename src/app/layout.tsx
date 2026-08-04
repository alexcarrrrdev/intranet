import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { DEFAULT_APP_NAME, getAppName, getAppSettingsSummary } from "@/lib/settings/app-settings";
import { buildThemeCssVariables, type ThemeVariableSet } from "@/lib/settings/color";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Métadonnées dynamiques : le titre reflète le nom de l'application
// configuré par un administrateur (voir /administration/general). En cas
// d'échec (ex. base de données indisponible), on retombe silencieusement
// sur le nom par défaut plutôt que de faire échouer le rendu.
export async function generateMetadata(): Promise<Metadata> {
  let appName = DEFAULT_APP_NAME;
  try {
    appName = await getAppName();
  } catch {
    // Volontairement ignoré (voir commentaire ci-dessus).
  }

  return {
    title: appName,
    description: "Base commune pour les systèmes de gestion clients",
  };
}

/** Sérialise un jeu de variables (voir ThemeVariableSet dans
 * src/lib/settings/color.ts) en déclarations CSS (`--nom:valeur;...`), pour
 * composer le contenu du <style> ci-dessous. */
function serializeThemeVariables(vars: ThemeVariableSet): string {
  return Object.entries(vars)
    .map(([name, value]) => `${name}:${value}`)
    .join(";");
}

/**
 * Construit le contenu du <style> de thème à partir d'une couleur
 * principale personnalisée — voir buildThemeCssVariables dans
 * src/lib/settings/color.ts pour le détail des variables surchargées et
 * leur calcul (contraste du texte, variante mode sombre).
 */
function buildThemeStyleContent(primaryColor: string): string {
  const { light, dark } = buildThemeCssVariables(primaryColor);
  return `:root{${serializeThemeVariables(light)}}.dark{${serializeThemeVariables(dark)}}`;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Couleur principale personnalisée (voir /administration/general, carte
  // « Couleur principale ») : `null` tant qu'aucun administrateur n'en a
  // choisi une, auquel cas rien n'est rendu ci-dessous et le thème par
  // défaut de globals.css s'applique intégralement, inchangé.
  //
  // Délègue à `getAppSettingsSummary` (mémorisée avec `cache()`) plutôt qu'à
  // sa propre requête : `generateMetadata` ci-dessus l'a déjà appelée (via
  // `getAppName`) pour ce même rendu, donc cet appel ne coûte AUCUNE requête
  // supplémentaire — voir le commentaire de `getAppSettingsSummary` dans
  // src/lib/settings/app-settings.ts.
  //
  // Rendu directement dans ce Server Component (PAS dans generateMetadata,
  // qui ne gère que les balises <title>/<meta> — voir
  // node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/
  // layout.md, « The root layout must define <html> and <body> tags [...]
  // you should not manually add <head> tags such as <title> and <meta> to
  // root layouts »). Un <style> n'est pas une balise de métadonnées : c'est
  // un élément de contenu ordinaire, que React/Next.js rend tel quel, ici en
  // tout premier enfant de <body> — avant tout composant qui pourrait
  // afficher une couleur "primary" (barre latérale, boutons...). Comme tout
  // le reste de ce composant, c'est rendu CÔTÉ SERVEUR et fait partie du
  // MÊME HTML que le reste de la page : contrairement à une solution qui
  // appliquerait la couleur via un effet client après le premier rendu, il
  // n'y a donc aucun clignotement (la CSP du projet autorise déjà les
  // <style> inline, voir style-src dans next.config.ts) — y compris sur les
  // pages publiques (connexion, mot de passe oublié...), qui rendent aussi
  // ce layout racine.
  //
  // Le texte du <style> est construit à partir de couleurs déjà validées en
  // amont (isValidHexColor, voir src/lib/settings/schemas.ts) et de valeurs
  // calculées par buildThemeCssVariables (jamais de chaîne arbitraire) :
  // rendu en enfant texte du <style>, jamais via dangerouslySetInnerHTML.
  let primaryColor: string | null = null;
  try {
    ({ primaryColor } = await getAppSettingsSummary());
  } catch {
    // Même repli que generateMetadata ci-dessus : si les paramètres sont
    // illisibles (ex. base de données indisponible), le thème par défaut
    // s'applique simplement, sans faire échouer le rendu.
  }

  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {primaryColor && <style>{buildThemeStyleContent(primaryColor)}</style>}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
