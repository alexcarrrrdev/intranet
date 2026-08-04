"use client"

import { useState } from "react"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { CircleAlertIcon } from "lucide-react"

import { loginAction } from "@/app/actions/auth"
import { loginSchema, type LoginInput } from "@/lib/auth/schemas"
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

export function LoginForm() {
  const [isPending, setIsPending] = useState(false)
  // L'erreur de connexion est affichée dans le formulaire lui-même (et non
  // dans un toast) : elle reste visible tant que l'utilisateur n'a pas
  // retenté, juste au-dessus des champs concernés.
  const [error, setError] = useState<string | null>(null)
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  async function onSubmit(values: LoginInput) {
    setIsPending(true)
    setError(null)
    try {
      // En cas de succès, loginAction() effectue elle-même la redirection
      // (redirect() lance une exception spéciale gérée par Next.js) : on
      // n'atteint la ligne suivante que si l'authentification a échoué.
      const result = await loginAction(values)
      if (result?.error) {
        setError(result.error)
      }
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
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Mot de passe</FormLabel>
                <Link
                  href="/mot-de-passe-oublie"
                  className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                >
                  Mot de passe oublié ?
                </Link>
              </div>
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
        <Button type="submit" className="mt-2 w-full" disabled={isPending}>
          {isPending ? "Connexion en cours..." : "Se connecter"}
        </Button>
      </form>
    </Form>
  )
}
