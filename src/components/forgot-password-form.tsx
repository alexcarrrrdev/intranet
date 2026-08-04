"use client"

import { useState } from "react"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { forgotPasswordAction } from "@/app/actions/auth"
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/auth/schemas"
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

export function ForgotPasswordForm() {
  const [isPending, setIsPending] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  })

  async function onSubmit(values: ForgotPasswordInput) {
    setIsPending(true)
    try {
      await forgotPasswordAction(values)
    } finally {
      setIsPending(false)
      // Message neutre affiché dans tous les cas, que le compte existe ou
      // non, pour éviter l'énumération de comptes par courriel.
      setIsSubmitted(true)
    }
  }

  if (isSubmitted) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Si un compte existe avec cette adresse courriel, un lien de
          réinitialisation vient de lui être envoyé. Vérifiez votre boîte de
          réception (et vos courriels indésirables).
        </p>
        <Button variant="outline" className="w-full" render={<Link href="/" />}>
          Retour à la connexion
        </Button>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Courriel</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="nom@exemple.com"
                  autoComplete="email"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="mt-2 w-full" disabled={isPending}>
          {isPending ? "Envoi en cours..." : "Envoyer le lien de réinitialisation"}
        </Button>
        <Button variant="ghost" className="w-full" render={<Link href="/" />}>
          Retour à la connexion
        </Button>
      </form>
    </Form>
  )
}
