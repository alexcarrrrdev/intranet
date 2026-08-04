import { redirect } from "next/navigation"

import { hasPermission } from "@/lib/auth/permissions"
import { getCurrentSession } from "@/lib/auth/session"
import { listGroups } from "@/lib/groups/groups"
import { GroupsGrid } from "@/components/groups/groups-grid"
import { NewGroupDialog } from "@/components/groups/new-group-dialog"

// Page /groupes : grille de groupes, Rejoindre/Quitter ouvert à tout le
// monde, création/suppression protégées par group:manage.
export default async function GroupesPage() {
  const session = await getCurrentSession()

  if (!session) {
    redirect("/")
  }

  const [groups, canManage] = await Promise.all([
    listGroups(session.user.id),
    hasPermission(session.user, "group", "manage"),
  ])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {groups.length === 0
            ? "Aucun groupe pour le moment."
            : "Rejoignez un groupe pour accéder à son fil de discussion."}
        </p>
        {canManage && <NewGroupDialog />}
      </div>

      <GroupsGrid groups={groups} canManage={canManage} />
    </div>
  )
}
