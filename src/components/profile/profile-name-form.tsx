"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { CircleAlertIcon } from "lucide-react"
import { toast } from "sonner"

import { updateNameAction } from "@/app/actions/profile"
import { updateNameSchema, type UpdateNameInput } from "@/lib/auth/schemas"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type ProfileNameFormProps = {
  defaultName: string
  email: string
  roleLabel: string
}

export function ProfileNameForm({
  defaultName,
  email,
  roleLabel,
}: ProfileNameFormProps) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  // Même principe que les formulaires d'authentification : l'erreur reste
  // affichée dans le formulaire (et non dans un toast).
  const [error, setError] = useState<string | null>(null)
  const form = useForm<UpdateNameInput>({
    resolver: zodResolver(updateNameSchema),
    defaultValues: { name: defaultName },
  })

  async function onSubmit(values: UpdateNameInput) {
    setIsPending(true)
    setError(null)
    try {
      const result = await updateNameAction(values)
      if (result?.error) {
        setError(result.error)
        return
      }
      toast.success("Vos informations ont été enregistrées.")
      // Rafraîchit les Server Components (dont le bloc utilisateur de la
      // barre latérale) sans recharger toute la page.
      router.refresh()
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        {error && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>{error}</AlertTitle>
          </Alert>
        )}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nom complet</FormLabel>
              <FormControl>
                <Input autoComplete="name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-2">
          <Label htmlFor="profile-email">Courriel</Label>
          <Input id="profile-email" value={email} disabled readOnly />
          <p className="text-sm text-muted-foreground">
            Le courriel ne peut pas être modifié pour le moment.
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="profile-role">Rôle</Label>
          <Input id="profile-role" value={roleLabel} disabled readOnly />
        </div>
        <Button type="submit" className="mt-2 w-fit" disabled={isPending}>
          {isPending ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </form>
    </Form>
  )
}
