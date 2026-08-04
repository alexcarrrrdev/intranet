"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { CircleAlertIcon } from "lucide-react"
import { toast } from "sonner"

import { changePasswordAction } from "@/app/actions/profile"
import {
  changePasswordSchema,
  type ChangePasswordInput,
} from "@/lib/auth/schemas"
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

export function ChangePasswordForm() {
  const [isPending, setIsPending] = useState(false)
  // Un mauvais mot de passe actuel est affiché dans le formulaire, jamais
  // dans un toast (voir src/components/login-form.tsx pour le même principe).
  const [error, setError] = useState<string | null>(null)
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  })

  async function onSubmit(values: ChangePasswordInput) {
    setIsPending(true)
    setError(null)
    try {
      const result = await changePasswordAction(values)
      if (result?.error) {
        setError(result.error)
        return
      }
      toast.success("Votre mot de passe a été modifié.")
      form.reset()
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
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mot de passe actuel</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="current-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nouveau mot de passe</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirmer le nouveau mot de passe</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <p className="text-sm text-muted-foreground">
          Changer votre mot de passe déconnectera automatiquement tous vos
          autres appareils.
        </p>
        <Button type="submit" className="mt-2 w-fit" disabled={isPending}>
          {isPending ? "Modification en cours..." : "Changer le mot de passe"}
        </Button>
      </form>
    </Form>
  )
}
