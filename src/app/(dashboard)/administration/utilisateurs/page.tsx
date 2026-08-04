import { redirect } from "next/navigation"

import { hasPermission } from "@/lib/auth/permissions"
import { getCurrentSession } from "@/lib/auth/session"
import { listUsers } from "@/lib/auth/users"
import { UsersTable } from "@/components/administration/users-table"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// Vérification qui fait autorité : un utilisateur sans la permission
// `user:read` ne doit pouvoir ni voir ni soumettre les formulaires de cette
// page, même s'il navigue directement vers cette URL — le fait que l'entrée
// de menu « Utilisateurs » soit cachée (voir src/components/app-sidebar.tsx)
// n'est qu'un confort d'UI, pas une mesure de sécurité. Même principe que
// /administration/general/page.tsx.
export default async function AdministrationUtilisateursPage() {
  const session = await getCurrentSession()

  if (!session) {
    redirect("/")
  }

  if (!(await hasPermission(session.user, "user", "read"))) {
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

  const [users, canCreate, canUpdate, canDelete] = await Promise.all([
    listUsers(),
    hasPermission(session.user, "user", "create"),
    hasPermission(session.user, "user", "update"),
    hasPermission(session.user, "user", "delete"),
  ])

  return (
    <UsersTable
      users={users}
      currentUserId={session.user.id}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
    />
  )
}
