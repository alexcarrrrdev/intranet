"use client"

import type { ComponentProps } from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

// Enveloppe fine autour de next-themes : garde le composant client isolé du
// layout racine (Server Component), comme le veut la convention Next.js
// pour les providers React Context.
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
