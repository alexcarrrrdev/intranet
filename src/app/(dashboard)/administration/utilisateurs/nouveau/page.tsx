import { redirect } from "next/navigation"

import { hasPermission } from "@/lib/auth/permissions"
import { getCurrentSession } from "@/lib/auth/session"
import { listRoles } from "@/lib/auth/roles"
import { BackLink } from "@/components/administration/back-link"
import { UserCreateForm } from "@/components/administration/user-create-form"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// Vérification qui fait autorité : voir le commentaire équivalent dans
// /administration/utilisateurs/page.tsx.
export default async function NouvelUtilisateurPage() {
  const session = await getCurrentSession()

  if (!session) {
    redirect("/")
  }

  if (!(await hasPermission(session.user, "user", "create"))) {
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

  const roles = await listRoles()

  return (
    <div className="flex flex-col gap-4">
      <BackLink
        href="/administration/utilisateurs"
        label="Retour aux utilisateurs"
      />
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Créer un utilisateur
        </h1>
        <p className="text-sm text-muted-foreground">
          Le compte est créé immédiatement avec le mot de passe fourni.
        </p>
      </div>
      <UserCreateForm roles={roles} />
    </div>
  )
}
