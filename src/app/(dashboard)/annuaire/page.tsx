import { redirect } from "next/navigation"

import { getCurrentSession } from "@/lib/auth/session"
import { listUsers } from "@/lib/auth/users"
import { DirectoryGrid } from "@/components/annuaire/directory-grid"

// Page /annuaire : trombinoscope de tous les utilisateurs actifs (voir
// listUsers dans src/lib/auth/users.ts, qui exclut déjà les comptes
// supprimés — deleted_at non NULL). Ouverte à tout utilisateur connecté,
// aucune permission particulière requise (voir src/components/app-sidebar.tsx).
export default async function AnnuairePage() {
  const session = await getCurrentSession()

  if (!session) {
    redirect("/")
  }

  const users = await listUsers()

  return (
    <DirectoryGrid
      users={users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        roleName: user.roleName,
        image: user.image,
      }))}
    />
  )
}
