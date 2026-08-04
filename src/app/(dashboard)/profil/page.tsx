import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { getCurrentSession } from "@/lib/auth/session"
import { roleLabels } from "@/lib/auth/permissions"
import { getRole } from "@/lib/auth/roles"
import {
  ActiveSessionsCard,
  type SessionSummary,
} from "@/components/profile/active-sessions-card"
import { ChangePasswordForm } from "@/components/profile/change-password-form"
import { ProfileNameForm } from "@/components/profile/profile-name-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default async function ProfilPage() {
  const session = await getCurrentSession()

  if (!session) {
    redirect("/")
  }

  // Le nom d'affichage du rôle vient désormais de la base (`role.name`,
  // modifiable — voir src/lib/auth/roles.ts) plutôt que d'une table statique.
  // `roleLabels` ne sert plus que de repli si la rangée est introuvable
  // (ne devrait pas arriver : `user.role` référence `role.id` avec ON
  // DELETE RESTRICT, voir src/db/schema.ts).
  const roleRow = await getRole(session.user.role)
  const roleLabel =
    roleRow?.name ?? roleLabels[session.user.role ?? ""] ?? session.user.role

  // La liste des sessions requiert une session « fraîche » côté Better Auth
  // (voir freshSessionMiddleware) ; en cas d'échec on affiche un message
  // plutôt que de faire planter toute la page.
  let sessions: SessionSummary[] = []
  let loadError = false
  try {
    const rawSessions = await auth.api.listSessions({
      headers: await headers(),
    })
    sessions = rawSessions
      .map((rawSession) => ({
        token: rawSession.token,
        ipAddress: rawSession.ipAddress ?? null,
        userAgent: rawSession.userAgent ?? null,
        createdAt: rawSession.createdAt.toISOString(),
        expiresAt: rawSession.expiresAt.toISOString(),
        isCurrent: rawSession.token === session.session.token,
      }))
      .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent))
  } catch {
    loadError = true
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Mes informations</CardTitle>
          <CardDescription>
            Gérez les informations de votre compte.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileNameForm
            defaultName={session.user.name}
            email={session.user.email}
            roleLabel={roleLabel}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Changer mon mot de passe</CardTitle>
          <CardDescription>
            Choisissez un nouveau mot de passe pour votre compte.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mes sessions actives</CardTitle>
          <CardDescription>
            Appareils actuellement connectés à votre compte.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActiveSessionsCard sessions={sessions} loadError={loadError} />
        </CardContent>
      </Card>
    </div>
  )
}
