import { redirect } from "next/navigation"

import {
  actionLabels,
  hasPermission,
  resourceLabels,
  statement,
  type Resource,
} from "@/lib/auth/permissions"
import { getCurrentSession } from "@/lib/auth/session"
import { BackLink } from "@/components/administration/back-link"
import type { PermissionCatalogEntry } from "@/components/administration/permission-matrix"
import { RoleCreateForm } from "@/components/administration/role-create-form"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// Vérification qui fait autorité : voir le commentaire équivalent dans
// /administration/roles/page.tsx.
export default async function NouveauRolePage() {
  const session = await getCurrentSession()

  if (!session) {
    redirect("/")
  }

  if (!(await hasPermission(session.user, "role", "create"))) {
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

  // Catalogue ressource × action (`statement`, src/lib/auth/permissions.ts)
  // mis en forme avec ses libellés français pour la matrice de permissions
  // — transmis en props plutôt qu'importé côté client, voir le commentaire
  // de PermissionMatrix.
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
          Créer un rôle
        </h1>
        <p className="text-sm text-muted-foreground">
          Définissez le nom et les permissions accordées à ce rôle.
        </p>
      </div>
      <RoleCreateForm catalog={catalog} />
    </div>
  )
}
