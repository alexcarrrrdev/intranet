import { redirect } from "next/navigation"

import { hasPermission } from "@/lib/auth/permissions"
import { getCurrentSession } from "@/lib/auth/session"
import { listUpcomingEvents } from "@/lib/events/events"
import { EventList } from "@/components/events/event-list"
import { NewEventDialog } from "@/components/events/new-event-dialog"

// Page /calendrier : liste des événements à venir groupés par mois (v1, pas
// de grille mensuelle — voir le plan produit). event:manage : création et
// suppression.
export default async function CalendrierPage() {
  const session = await getCurrentSession()

  if (!session) {
    redirect("/")
  }

  const [events, canManage] = await Promise.all([
    listUpcomingEvents(session.user.id),
    hasPermission(session.user, "event", "manage"),
  ])

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {events.length === 0
            ? "Aucun événement à venir."
            : "Les événements à venir, du plus proche au plus lointain."}
        </p>
        {canManage && <NewEventDialog />}
      </div>

      <EventList events={events} canManage={canManage} />
    </div>
  )
}
