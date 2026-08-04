import { UsersRoundIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { GroupCard } from "@/components/groups/group-card"
import type { GroupListItem } from "@/lib/groups/groups"

type GroupsGridProps = {
  groups: GroupListItem[]
  canManage: boolean
}

// Grille de cartes de groupes (/groupes) — état vide soigné sinon.
export function GroupsGrid({ groups, canManage }: GroupsGridProps) {
  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <UsersRoundIcon className="size-8" />
          <p className="text-sm">
            Aucun groupe pour le moment.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((group) => (
        <GroupCard key={group.id} group={group} canManage={canManage} />
      ))}
    </div>
  )
}
