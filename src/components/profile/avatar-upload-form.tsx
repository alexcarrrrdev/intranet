"use client"

import { useState, type ChangeEvent, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { CircleAlertIcon } from "lucide-react"
import { toast } from "sonner"

import { removeAvatarAction, updateAvatarAction } from "@/app/actions/profile"
import { getInitials } from "@/components/nav-user"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// Formats acceptés côté client (contrôle facilitant l'UX via le sélecteur de
// fichiers du navigateur) — la validation qui fait autorité est refaite
// côté serveur dans updateAvatarAction, voir
// src/lib/settings/avatar-validation.ts. Contrairement au logo, SVG n'est
// pas proposé ici (voir le commentaire de ce fichier).
const ACCEPTED_AVATAR_TYPES = "image/png,image/jpeg,image/webp"

type AvatarUploadFormProps = {
  name: string
  email: string
  image: string | null
}

// Formulaire de la carte « Photo de profil » de /profil, même patron que
// LogoUploadForm (src/components/administration/logo-upload-form.tsx) pour
// le logo de l'application, mais sur la photo de l'utilisateur CONNECTÉ
// uniquement (aucun paramètre d'identifiant : la Server Action déduit
// toujours l'utilisateur de sa propre session, voir
// src/app/actions/profile.ts).
export function AvatarUploadForm({ name, email, image }: AvatarUploadFormProps) {
  const router = useRouter()
  // Même raison que LogoUploadForm : un input de type fichier ne peut pas
  // être « contrôlé » par React, on mémorise donc l'objet File choisi via
  // son onChange plutôt que de le relire depuis le <form> à la soumission.
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isPending = isUploading || isRemoving
  const initials = getInitials(name, email)

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setSelectedFile(file)
    setError(null)
    // Aperçu local immédiat (avant l'envoi au serveur), via une URL blob —
    // voir "img-src" dans next.config.ts (blob: est explicitement autorisé
    // par la CSP pour cette raison).
    setPreviewUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous)
      return file ? URL.createObjectURL(file) : null
    })
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Capturé avant le premier `await` : voir le commentaire équivalent dans
    // LogoUploadForm pour la raison (React remet `currentTarget` à `null`
    // dès la fin du traitement synchrone du gestionnaire).
    const form = event.currentTarget
    if (!selectedFile) {
      setError("Veuillez sélectionner un fichier.")
      return
    }

    setIsUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.set("avatar", selectedFile)
      const result = await updateAvatarAction(formData)
      if (result?.error) {
        setError(result.error)
        return
      }
      toast.success("La photo de profil a été enregistrée.")
      form.reset()
      setSelectedFile(null)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
      // Rafraîchit la barre latérale et cette page (Server Components) sans
      // recharger toute l'application — même principe que LogoUploadForm.
      router.refresh()
    } finally {
      setIsUploading(false)
    }
  }

  async function handleRemove() {
    setIsRemoving(true)
    setError(null)
    try {
      const result = await removeAvatarAction()
      if (result?.error) {
        setError(result.error)
        return
      }
      toast.success("La photo de profil a été retirée.")
      router.refresh()
    } finally {
      setIsRemoving(false)
    }
  }

  const displayedImage = previewUrl ?? image

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      )}
      <div className="flex items-center gap-4">
        <Avatar size="lg" className="size-16">
          {displayedImage ? (
            <AvatarImage src={displayedImage} alt="" />
          ) : null}
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        {!image && !previewUrl && (
          <p className="text-sm text-muted-foreground">
            Aucune photo de profil n&apos;est configurée : vos initiales sont
            affichées à la place dans toute l&apos;application.
          </p>
        )}
      </div>
      <form onSubmit={handleUpload} className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor="avatar">Fichier</Label>
          <Input
            id="avatar"
            name="avatar"
            type="file"
            accept={ACCEPTED_AVATAR_TYPES}
            disabled={isPending}
            onChange={handleFileChange}
          />
          <p className="text-sm text-muted-foreground">
            PNG, JPEG ou WebP — 10 Mo maximum.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="w-fit" disabled={isPending}>
            {isUploading ? "Envoi..." : "Téléverser une photo"}
          </Button>
          {image && (
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              disabled={isPending}
              onClick={handleRemove}
            >
              {isRemoving ? "Retrait..." : "Retirer"}
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
