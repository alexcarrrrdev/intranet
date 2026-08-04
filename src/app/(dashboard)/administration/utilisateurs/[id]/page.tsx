import { redirect } from "next/navigation"

import { hasPermission } from "@/lib/auth/permissions"
import { getCurrentSession } from "@/lib/auth/session"
import { listRoles } from "@/lib/auth/roles"
import { getUser } from "@/lib/auth/users"
import { BackLink } from "@/components/administration/back-link"
import { UserEditForm } from "@/components/administration/user-edit-form"
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
// /administration/utilisateurs/page.tsx.
export default async function ModifierUtilisateurPage({ params }: PageProps) {
  const { id } = await params
  const session = await getCurrentSession()

  if (!session) {
    redirect("/")
  }

  if (!(await hasPermission(session.user, "user", "update"))) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink
          href="/administration/utilisateurs"
          label="Retour aux utilisateurs"
        />
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

  const [user, roles] = await Promise.all([getUser(id), listRoles()])

  if (!user) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink
          href="/administration/utilisateurs"
          label="Retour aux utilisateurs"
        />
        <Card>
          <CardHeader>
            <CardTitle>Utilisateur introuvable</CardTitle>
            <CardDescription>
              Cet utilisateur n&apos;existe pas ou a déjà été supprimé.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <BackLink
        href="/administration/utilisateurs"
        label="Retour aux utilisateurs"
      />
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Modifier {user.name}
        </h1>
      </div>
      <UserEditForm user={user} roles={roles} />
    </div>
  )
}
