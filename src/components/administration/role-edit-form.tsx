"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { CircleAlertIcon, LockIcon } from "lucide-react"
import { toast } from "sonner"
import type { z } from "zod"

import { updateRoleAction } from "@/app/actions/roles"
import type { RoleDetail } from "@/lib/auth/roles"
import { updateRoleSchema, type UpdateRoleInput } from "@/lib/auth/role-schemas"
import { ROLES_LIST_HREF } from "@/components/administration/role-create-form"
import {
  PermissionMatrix,
  type PermissionCatalogEntry,
} from "@/components/administration/permission-matrix"
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
import { Textarea } from "@/components/ui/textarea"

type RoleEditFormProps = {
  role: RoleDetail
  catalog: PermissionCatalogEntry[]
  // Vrai uniquement pour le rôle "admin" : son accès complet vient d'un
  // court-circuit dans le code (voir getPermissionsForRole,
  // src/lib/auth/permissions.ts) et updateRole (src/lib/auth/roles.ts) le
  // refuse explicitement — cette page reste néanmoins ACCESSIBLE (pas
  // d'« Accès refusé ») mais en LECTURE SEULE, avec une note explicative,
  // plutôt que de renvoyer une erreur pour une simple consultation.
  readOnly: boolean
}

// Formulaire de modification d'un rôle (/administration/roles/[id]), page
// dédiée — voir le commentaire d'en-tête de UserCreateForm pour le choix
// « page plutôt que Dialog ».
export function RoleEditForm({ role, catalog, readOnly }: RoleEditFormProps) {
  if (readOnly) {
    return (
      <div className="flex flex-col gap-4">
        <Alert>
          <LockIcon />
          <AlertTitle>
            Le rôle Administrateur ne peut pas être modifié.
          </AlertTitle>
        </Alert>
        <Card>
          <CardHeader>
            <CardTitle>Informations</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="role-view-name">Nom</Label>
              <Input id="role-view-name" value={role.name} disabled readOnly />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role-view-description">Description</Label>
              <Textarea
                id="role-view-description"
                value={role.description ?? ""}
                disabled
                readOnly
                rows={2}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Permissions</CardTitle>
            <CardDescription>
              Toutes les permissions du catalogue sont accordées
              automatiquement à ce rôle.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PermissionMatrix
              catalog={catalog}
              value={role.permissions}
              onChange={() => {}}
              disabled
            />
          </CardContent>
        </Card>
        <div className="flex justify-end">
          <Button variant="outline" render={<Link href={ROLES_LIST_HREF} />}>
            Retour aux rôles
          </Button>
        </div>
      </div>
    )
  }

  return <EditableRoleForm role={role} catalog={catalog} />
}

type EditableRoleFormProps = {
  role: RoleDetail
  catalog: PermissionCatalogEntry[]
}

// Séparé de RoleEditForm pour ne pas appeler les hooks de formulaire
// (useForm, etc.) dans la branche `readOnly` ci-dessus, qui ne les utilise
// pas — respecte les règles des Hooks (nombre d'appels constant par rendu).
function EditableRoleForm({ role, catalog }: EditableRoleFormProps) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Voir le commentaire équivalent dans RoleCreateForm : updateRoleSchema a
  // le même `.default([])` sur `permissions`.
  const form = useForm<
    z.input<typeof updateRoleSchema>,
    unknown,
    UpdateRoleInput
  >({
    resolver: zodResolver(updateRoleSchema),
    defaultValues: {
      name: role.name,
      description: role.description ?? "",
      permissions: role.permissions,
    },
  })

  async function onSubmit(values: UpdateRoleInput) {
    setIsPending(true)
    setError(null)
    try {
      const result = await updateRoleAction(role.id, values)
      if (result?.error) {
        setError(result.error)
        return
      }
      toast.success("Le rôle a été modifié.")
      // Pas de router.refresh() ici : voir le commentaire équivalent dans
      // RoleCreateForm (src/components/administration/role-create-form.tsx).
      router.push(ROLES_LIST_HREF)
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
            <CardDescription>Nom et description du rôle.</CardDescription>
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optionnelle)</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Permissions</CardTitle>
            <CardDescription>
              Permissions accordées à ce rôle, par ressource.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="permissions"
              render={({ field }) => (
                <FormItem>
                  <PermissionMatrix
                    catalog={catalog}
                    value={field.value ?? []}
                    onChange={field.onChange}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2">
          <Button variant="outline" render={<Link href={ROLES_LIST_HREF} />}>
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
