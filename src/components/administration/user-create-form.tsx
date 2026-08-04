"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { CircleAlertIcon } from "lucide-react"
import { toast } from "sonner"

import { createUserAction } from "@/app/actions/users"
import { createUserSchema, type CreateUserInput } from "@/lib/auth/user-schemas"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export const USERS_LIST_HREF = "/administration/utilisateurs"

export type RoleOption = {
  id: string
  name: string
}

type UserCreateFormProps = {
  roles: RoleOption[]
}

// Formulaire de création d'un utilisateur (/administration/utilisateurs/
// nouveau), en page dédiée plutôt qu'en Dialog : préférence durable du
// projet — les formulaires de création/édition vivent sur des pages
// organisées en sections (Card), les Dialog/AlertDialog restant réservés
// aux confirmations destructrices (voir DeleteUserAlertDialog dans
// users-table.tsx). Un seul <form> couvrant les deux sections
// (Informations/Rôle) : la soumission valide et envoie l'ensemble des champs
// en un seul appel à createUserAction.
export function UserCreateForm({ roles }: UserCreateFormProps) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { name: "", email: "", password: "", role: "" },
  })

  async function onSubmit(values: CreateUserInput) {
    setIsPending(true)
    setError(null)
    try {
      const result = await createUserAction(values)
      if (result?.error) {
        setError(result.error)
        return
      }
      toast.success("L'utilisateur a été créé.")
      // Pas de router.refresh() ici : voir le commentaire équivalent dans
      // RoleCreateForm (src/components/administration/role-create-form.tsx)
      // — appelé juste après router.push(), il annule sa requête RSC
      // (ERR_ABORTED, vérifié empiriquement), et /administration/utilisateurs
      // n'a de toute façon aucune durée de vie dans le cache client (lit la
      // session à chaque rendu).
      router.push(USERS_LIST_HREF)
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
        <Card>
          <CardHeader>
            <CardTitle>Informations</CardTitle>
            <CardDescription>
              Nom, courriel et mot de passe initial du compte.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Courriel</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
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
                  <FormLabel>Mot de passe initial</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <p className="text-sm text-muted-foreground">
                    Au moins 8 caractères. Communiquez-le à
                    l&apos;utilisateur en lui recommandant de le changer dès
                    sa première connexion.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Rôle</CardTitle>
            <CardDescription>
              Détermine les permissions accordées à ce compte.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rôle</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full sm:w-64">
                        <SelectValue placeholder="Sélectionner un rôle" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2">
          <Button variant="outline" render={<Link href={USERS_LIST_HREF} />}>
            Annuler
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Création..." : "Créer"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
