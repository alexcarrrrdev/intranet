import { redirect } from "next/navigation"

import { hasPermission } from "@/lib/auth/permissions"
import { getCurrentSession } from "@/lib/auth/session"
import { listAnnouncements } from "@/lib/announcements/announcements"
import { AnnouncementsList } from "@/components/announcements/announcements-list"
import { NewAnnouncementDialog } from "@/components/announcements/new-announcement-dialog"

// Page /annonces : liste antéchronologique (épinglées d'abord), marquage lu
// explicite, compteur « Lue par X/Y » pour les détenteurs de
// announcement:manage — voir src/lib/announcements/announcements.ts.
export default async function AnnoncesPage() {
  const session = await getCurrentSession()

  if (!session) {
    redirect("/")
  }

  const canManage = await hasPermission(session.user, "announcement", "manage")
  const announcements = await listAnnouncements({
    currentUserId: session.user.id,
    includeReadStats: canManage,
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {announcements.length === 0
            ? "Aucune annonce pour le moment."
            : "Les annonces les plus récentes en premier, épinglées en tête."}
        </p>
        {canManage && <NewAnnouncementDialog />}
      </div>

      <AnnouncementsList announcements={announcements} canManage={canManage} />
    </div>
  )
}
