import { redirect } from "next/navigation"

import {
  ADMIN_ROLE_ID,
  MEMBER_ROLE_ID,
  getPermissionsForRole,
  hasPermission,
} from "@/lib/auth/permissions"
import { getCurrentSession } from "@/lib/auth/session"
import { listRoles } from "@/lib/auth/roles"
import {
  RolesTable,
  type RoleRow,
} from "@/components/administration/roles-table"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// Vérification qui fait autorité : voir le commentaire équivalent dans
// /administration/utilisateurs/page.tsx et /administration/general/page.tsx.
export default async function AdministrationRolesPage() {
  const session = await getCurrentSession()

  if (!session) {
    redirect("/")
  }

  if (!(await hasPermission(session.user, "role", "read"))) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Accès refusé</CardTitle>
          <CardDescription>
            Vous n&apos;avez pas la permission d&apos;accéder à cette page.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const [roleList, canCreate, canUpdate, canDelete] = await Promise.all([
    listRoles(),
    hasPermission(session.user, "role", "create"),
    hasPermission(session.user, "role", "update"),
    hasPermission(session.user, "role", "delete"),
  ])

  // `listRoles()` ne renvoie volontairement pas les permissions de chaque
  // rôle (voir son commentaire dans src/lib/auth/roles.ts) : cette page en a
  // besoin pour afficher le nombre de permissions par rôle personnalisé. On
  // les résout ici via `getPermissionsForRole` (mémorisée avec `cache()`,
  // une requête par rôle — négligeable pour le nombre de rôles d'un
  // back-office) plutôt que d'ajouter une Server Action dédiée : c'est une
  // lecture, déjà couverte par la vérification `role:read` ci-dessus. Le
  // catalogue ressource × action (matrice de permissions) n'est plus
  // nécessaire ici : il est construit par les pages de création/édition
  // dédiées (/administration/roles/nouveau et /[id]).
  const roles: RoleRow[] = await Promise.all(
    roleList.map(async (role) => ({
      ...role,
      permissions: Array.from(await getPermissionsForRole(role.id)),
    })),
  )

  return (
    <RolesTable
      roles={roles}
      adminRoleId={ADMIN_ROLE_ID}
      memberRoleId={MEMBER_ROLE_ID}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
    />
  )
}
