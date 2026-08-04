"use client"

import { useState, type ChangeEvent, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { CircleAlertIcon } from "lucide-react"
import { toast } from "sonner"

import { removeLogoAction, uploadLogoAction } from "@/app/actions/app-settings"
import { BrandMark } from "@/components/brand-mark"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// Formats acceptés côté client (contrôle facilitant l'UX via le sélecteur de
// fichiers du navigateur) — la validation qui fait autorité est refaite
// côté serveur dans uploadLogoAction, voir src/lib/settings/logo-validation.ts.
const ACCEPTED_LOGO_TYPES = "image/png,image/jpeg,image/webp,image/svg+xml"

type LogoUploadFormProps = {
  hasLogo: boolean
  logoVersion: number
}

export function LogoUploadForm({ hasLogo, logoVersion }: LogoUploadFormProps) {
  const router = useRouter()
  // Le fichier choisi est gardé en state (plutôt que relu depuis le <form>
  // au moment de la soumission) : un input de type fichier ne peut pas être
  // « contrôlé » par React (le navigateur interdit d'assigner sa valeur par
  // script, pour des raisons de sécurité), mais on peut très bien mémoriser
  // l'objet File choisi via son onChange, ce qui reste la façon la plus
  // directe de le transmettre tel quel à la Server Action.
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isPending = isUploading || isRemoving

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null)
    setError(null)
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Capturé avant le premier `await` : React remet `event.currentTarget`
    // à `null` dès la fin du traitement synchrone du gestionnaire (même
    // sans le pooling d'événements des versions antérieures à React 17,
    // `currentTarget` n'a plus de sens après coup) — l'utiliser après un
    // `await` lèverait donc une erreur.
    const form = event.currentTarget
    if (!selectedFile) {
      setError("Veuillez sélectionner un fichier.")
      return
    }

    setIsUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.set("logo", selectedFile)
      const result = await uploadLogoAction(formData)
      if (result?.error) {
        setError(result.error)
        return
      }
      toast.success("Le logo a été enregistré.")
      form.reset()
      setSelectedFile(null)
      // Rafraîchit la barre latérale et cette page (Server Components) sans
      // recharger toute l'application — même principe que AppNameForm.
      router.refresh()
    } finally {
      setIsUploading(false)
    }
  }

  async function handleRemove() {
    setIsRemoving(true)
    setError(null)
    try {
      const result = await removeLogoAction()
      if (result?.error) {
        setError(result.error)
        return
      }
      toast.success("Le logo a été retiré.")
      router.refresh()
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      )}
      <div className="flex items-center gap-4">
        <BrandMark
          hasLogo={hasLogo}
          logoVersion={logoVersion}
          className="size-16"
          iconClassName="size-8"
        />
        {!hasLogo && (
          <p className="text-sm text-muted-foreground">
            Aucun logo personnalisé n&apos;est configuré : l&apos;icône
            par défaut ci-dessus est utilisée dans toute l&apos;application.
          </p>
        )}
      </div>
      <form onSubmit={handleUpload} className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor="logo">Fichier</Label>
          <Input
            id="logo"
            name="logo"
            type="file"
            accept={ACCEPTED_LOGO_TYPES}
            disabled={isPending}
            onChange={handleFileChange}
          />
          <p className="text-sm text-muted-foreground">
            PNG, JPEG, WebP ou SVG — 1 Mo maximum.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="w-fit" disabled={isPending}>
            {isUploading ? "Envoi..." : "Téléverser"}
          </Button>
          {hasLogo && (
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              disabled={isPending}
              onClick={handleRemove}
            >
              {isRemoving ? "Retrait..." : "Retirer le logo"}
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
