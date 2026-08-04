"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { CircleAlertIcon } from "lucide-react"
import { toast } from "sonner"

import {
  resetPrimaryColorAction,
  updatePrimaryColorAction,
} from "@/app/actions/app-settings"
import {
  updatePrimaryColorSchema,
  type UpdatePrimaryColorInput,
} from "@/lib/settings/schemas"
import { cn } from "@/lib/utils"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"

// Couleur quasi noire du thème PAR DÉFAUT (--primary en mode clair, voir
// src/app/globals.css : oklch(0.205 0 0) ≈ #171717) — utilisée à la fois
// comme valeur de repli du sélecteur natif tant qu'aucune couleur
// personnalisée n'est enregistrée, et comme premier preset ci-dessous (« la
// couleur par défaut, mais explicitement choisie »).
const DEFAULT_THEME_HEX = "#171717"

// Six suggestions professionnelles, en plus du sélecteur natif ci-dessous :
// évite à la plupart des administrateurs de devoir manipuler une roue
// chromatique pour un choix courant. Couleurs choisies dans la palette
// Tailwind (nuances 600/700, jamais les plus vives) pour rester sobres.
const PRESET_COLORS = [
  { hex: DEFAULT_THEME_HEX, label: "Noir (par défaut)" },
  { hex: "#2563eb", label: "Bleu" },
  { hex: "#16a34a", label: "Vert" },
  { hex: "#7c3aed", label: "Violet" },
  { hex: "#ea580c", label: "Orange" },
  { hex: "#b91c1c", label: "Rouge" },
] as const

type PrimaryColorFormProps = {
  // Couleur actuellement enregistrée (`app_settings.primary_color`), ou
  // `null` si le thème par défaut s'applique — voir
  // src/lib/settings/app-settings.ts (getAppSettingsSummary). Contrôle à la
  // fois la valeur initiale du formulaire et la visibilité du bouton
  // « Réinitialiser » (même principe que `hasLogo` dans LogoUploadForm).
  defaultPrimaryColor: string | null
}

export function PrimaryColorForm({ defaultPrimaryColor }: PrimaryColorFormProps) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isPending = isSaving || isResetting

  const form = useForm<UpdatePrimaryColorInput>({
    resolver: zodResolver(updatePrimaryColorSchema),
    defaultValues: { primaryColor: defaultPrimaryColor ?? DEFAULT_THEME_HEX },
  })

  // `useWatch` plutôt que `form.watch()` : la valeur retournée par `watch()`
  // n'est pas mémoïsable de façon sûre (React Compiler le signale, voir
  // `npm run lint`) — `useWatch` est l'équivalent réactif recommandé par
  // react-hook-form pour ce même besoin (aperçu en direct de la couleur
  // sélectionnée, sur le swatch et le contour des presets ci-dessous).
  const selectedColor = useWatch({ control: form.control, name: "primaryColor" })

  async function onSubmit(values: UpdatePrimaryColorInput) {
    setIsSaving(true)
    setError(null)
    try {
      const result = await updatePrimaryColorAction(values)
      if (result?.error) {
        setError(result.error)
        return
      }
      toast.success("La couleur principale a été enregistrée.")
      // Rafraîchit le <style> de thème injecté par le layout racine (Server
      // Component) ainsi que la barre latérale, sans recharger toute
      // l'application — même principe que AppNameForm/LogoUploadForm.
      router.refresh()
    } finally {
      setIsSaving(false)
    }
  }

  async function handleReset() {
    setIsResetting(true)
    setError(null)
    try {
      const result = await resetPrimaryColorAction()
      if (result?.error) {
        setError(result.error)
        return
      }
      form.reset({ primaryColor: DEFAULT_THEME_HEX })
      toast.success("La couleur principale a été réinitialisée.")
      router.refresh()
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {error && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>{error}</AlertTitle>
          </Alert>
        )}

        <div className="flex items-center gap-3">
          <div
            className="size-10 shrink-0 rounded-md border"
            style={{ backgroundColor: selectedColor || DEFAULT_THEME_HEX }}
            aria-hidden
          />
          {defaultPrimaryColor ? (
            <p className="text-sm text-muted-foreground">
              Couleur actuelle : <span className="font-mono">{defaultPrimaryColor}</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucune couleur personnalisée : le thème par défaut de
              l&apos;application est utilisé.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Suggestions</span>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((preset) => (
              <button
                key={preset.hex}
                type="button"
                aria-label={preset.label}
                title={preset.label}
                disabled={isPending}
                onClick={() =>
                  form.setValue("primaryColor", preset.hex, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                className={cn(
                  "size-8 shrink-0 rounded-full border-2 outline-none transition-all focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
                  selectedColor?.toLowerCase() === preset.hex
                    ? "border-foreground"
                    : "border-transparent hover:border-muted-foreground/50",
                )}
                style={{ backgroundColor: preset.hex }}
              />
            ))}
          </div>
        </div>

        <FormField
          control={form.control}
          name="primaryColor"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Couleur personnalisée</FormLabel>
              <div className="flex items-center gap-3">
                <FormControl>
                  <input
                    type="color"
                    value={/^#[0-9a-f]{6}$/i.test(field.value) ? field.value.toLowerCase() : DEFAULT_THEME_HEX}
                    onChange={(event) => field.onChange(event.target.value)}
                    disabled={isPending}
                    className="h-9 w-14 cursor-pointer rounded border border-input bg-transparent p-1"
                  />
                </FormControl>
                <span className="font-mono text-sm text-muted-foreground">
                  {field.value}
                </span>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2">
          <Button type="submit" className="w-fit" disabled={isPending}>
            {isSaving ? "Enregistrement..." : "Enregistrer"}
          </Button>
          {defaultPrimaryColor && (
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              disabled={isPending}
              onClick={handleReset}
            >
              {isResetting ? "Réinitialisation..." : "Réinitialiser"}
            </Button>
          )}
        </div>
      </form>
    </Form>
  )
}
