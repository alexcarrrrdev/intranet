"use client"

import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const themeOptions = [
  { value: "light", label: "Clair" },
  { value: "dark", label: "Sombre" },
  { value: "system", label: "Système" },
] as const

const themeLabels: Record<string, string> = Object.fromEntries(
  themeOptions.map((option) => [option.value, option.label]),
)

// N'a jamais besoin de se resouscrire à quoi que ce soit : sert uniquement à
// distinguer le premier rendu serveur (SSR, toujours `false`) du rendu
// client une fois monté, via useSyncExternalStore plutôt qu'un
// useState+useEffect (voir src/hooks/use-mobile.ts pour le même principe) —
// ce qui évite un appel à setState synchrone dans un effet.
function subscribe() {
  return () => {}
}

function useMounted() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
}

export function ThemeSelector() {
  const { theme, setTheme } = useTheme()
  // Le thème réel n'est connu qu'après le montage côté client (il dépend de
  // localStorage / des préférences système) : on évite de rendre une valeur
  // avant ce moment pour ne pas provoquer de désaccord d'hydratation ni de
  // flash d'un mauvais thème sélectionné dans la liste.
  const mounted = useMounted()

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="theme-selector">Thème</Label>
      <Select
        value={mounted ? (theme ?? "system") : undefined}
        onValueChange={(value) => {
          if (value) setTheme(value)
        }}
      >
        <SelectTrigger id="theme-selector" className="w-48">
          <SelectValue placeholder="Système">
            {(value: string | null) =>
              value ? (themeLabels[value] ?? value) : "Système"
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {themeOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-sm text-muted-foreground">
        « Système » suit le réglage clair/sombre de votre appareil.
      </p>
    </div>
  )
}
