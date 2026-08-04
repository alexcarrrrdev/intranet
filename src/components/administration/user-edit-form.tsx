"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { CircleAlertIcon } from "lucide-react"
import { toast } from "sonner"

import { updateUserAction } from "@/app/actions/users"
import type { UserDetail } from "@/lib/auth/users"
import { updateUserSchema, type UpdateUserInput } from "@/lib/auth/user-schemas"
import { USERS_LIST_HREF, type RoleOption } from "@/components/administration/user-create-form"
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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type UserEditFormProps = {
  user: UserDetail
  roles: RoleOption[]
}

function roleLabel(roles: RoleOption[], id: string | null): string | null {
  if (!id) return null
  return roles.find((role) => role.id === id)?.name ?? id
}

// Formulaire de modification d'un utilisateur
// (/administration/utilisateurs/[id]), page dédiée — voir le commentaire
// d'en-tête de UserCreateForm pour le choix « page plutôt que Dialog ». Le
// garde-fou serveur « on ne peut pas changer son propre rôle » (voir
// updateUser, src/lib/auth/users.ts) s'affiche ici, dans l'Alert inline en
// haut de page, exactement comme n'importe quelle autre erreur d'action.
export function UserEditForm({ user, roles }: UserEditFormProps) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const form = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: { name: user.name, role: user.role },
  })

  async function onSubmit(values: UpdateUserInput) {
    setIsPending(true)
    setError(null)
    try {
      const result = await updateUserAction(user.id, values)
      if (result?.error) {
        setError(result.error)
        return
      }
      toast.success("L'utilisateur a été modifié.")
      // Pas de router.refresh() ici : voir le commentaire équivalent dans
      // RoleCreateForm (src/components/administration/role-create-form.tsx).
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
            <CardDescription>Nom et courriel du compte.</CardDescription>
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
            <div className="grid gap-2">
              <Label htmlFor="user-edit-email">Courriel</Label>
              <Input id="user-edit-email" value={user.email} disabled readOnly />
              <p className="text-sm text-muted-foreground">
                Le courriel ne peut pas être modifié pour le moment.
              </p>
            </div>
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
                        {/* Fonction de rendu explicite (comme ThemeSelector,
                        src/components/settings/theme-selector.tsx) plutôt
                        que de laisser SelectValue déduire le libellé du
                        SelectItem correspondant : la valeur initiale vient
                        de defaultValues (pas d'une sélection dans le menu
                        déjà ouvert une fois), donc Base UI n'a pas encore
                        « vu » l'item et afficherait sinon l'identifiant brut
                        du rôle (ex. "member") au lieu de son nom. */}
                        <SelectValue placeholder="Sélectionner un rôle">
                          {(value: string | null) =>
                            roleLabel(roles, value) ?? "Sélectionner un rôle"
                          }
                        </SelectValue>
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
            {isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
