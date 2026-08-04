import { redirect } from "next/navigation"

import { hasPermission } from "@/lib/auth/permissions"
import { getCurrentSession } from "@/lib/auth/session"
import { listAuditEntries, listDistinctActors } from "@/lib/audit/audit"
import { AuditLogTable } from "@/components/administration/audit-log-table"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const PER_PAGE = 20

type AdministrationJournalPageProps = {
  searchParams: Promise<{ page?: string; action?: string; acteur?: string }>
}

// Vérification qui fait autorité : voir le commentaire équivalent dans
// /administration/utilisateurs/page.tsx, /administration/roles/page.tsx et
// /administration/general/page.tsx — un utilisateur sans `audit:read` ne
// doit pouvoir consulter cette page ni par le menu (déjà caché, voir
// src/components/app-sidebar.tsx) ni par une navigation directe vers l'URL.
export default async function AdministrationJournalPage({
  searchParams,
}: AdministrationJournalPageProps) {
  const session = await getCurrentSession()

  if (!session) {
    redirect("/")
  }

  if (!(await hasPermission(session.user, "audit", "read"))) {
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

  const { page: pageParam, action, acteur } = await searchParams
  const parsedPage = Number(pageParam)
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1

  const [{ entries, total }, actors] = await Promise.all([
    listAuditEntries({ page, perPage: PER_PAGE, action, actorId: acteur }),
    listDistinctActors(),
  ])

  return (
    <AuditLogTable
      entries={entries}
      total={total}
      page={page}
      perPage={PER_PAGE}
      actionFilter={action}
      actorFilter={acteur}
      actors={actors}
    />
  )
}
