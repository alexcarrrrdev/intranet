import { redirect } from "next/navigation"

import {
  ADMIN_ROLE_ID,
  actionLabels,
  hasPermission,
  resourceLabels,
  statement,
  type Resource,
} from "@/lib/auth/permissions"
import { getCurrentSession } from "@/lib/auth/session"
import { getRole } from "@/lib/auth/roles"
import { BackLink } from "@/components/administration/back-link"
import type { PermissionCatalogEntry } from "@/components/administration/permission-matrix"
import { RoleEditForm } from "@/components/administration/role-edit-form"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type PageProps = {
  params: Promise<{ id: string }>
}

// Vérification qui fait autorité : voir le commentaire équivalent dans
// /administration/roles/page.tsx.
export default async function ModifierRolePage({ params }: PageProps) {
  const { id } = await params
  const session = await getCurrentSession()

  if (!session) {
    redirect("/")
  }

  if (!(await hasPermission(session.user, "role", "update"))) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink href="/administration/roles" label="Retour aux rôles" />
        <Card>
          <CardHeader>
            <CardTitle>Accès refusé</CardTitle>
            <CardDescription>
              Vous n&apos;avez pas la permission d&apos;accéder à cette
              page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const role = await getRole(id)

  if (!role) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink href="/administration/roles" label="Retour aux rôles" />
        <Card>
          <CardHeader>
            <CardTitle>Rôle introuvable</CardTitle>
            <CardDescription>
              Ce rôle n&apos;existe pas ou a déjà été supprimé.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const catalog: PermissionCatalogEntry[] = (
    Object.keys(statement) as Resource[]
  ).map((resource) => ({
    resource,
    label: resourceLabels[resource],
    actions: statement[resource].map((action) => ({
      action,
      label: actionLabels[action],
    })),
  }))

  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/administration/roles" label="Retour aux rôles" />
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Modifier {role.name}
        </h1>
      </div>
      <RoleEditForm
        role={role}
        catalog={catalog}
        readOnly={role.id === ADMIN_ROLE_ID}
      />
    </div>
  )
}
