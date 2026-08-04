"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CircleAlertIcon, MoreHorizontalIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { deleteUserAction } from "@/app/actions/users"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// Formate une date en français (Québec), sans l'heure — suffisant pour une
// colonne « Créé le » de tableau d'administration.
const dateFormatter = new Intl.DateTimeFormat("fr-CA", { dateStyle: "long" })

export type UserRow = {
  id: string
  name: string
  email: string
  role: string
  roleName: string
  createdAt: Date
}

type UsersTableProps = {
  users: UserRow[]
  currentUserId: string
  // Permissions accordées à l'utilisateur courant ("user:create",
  // "user:update", "user:delete" — voir src/lib/auth/permissions.ts),
  // résolues côté serveur (page /administration/utilisateurs) et transmises
  // ici sous forme de booléens déjà calculés : ce composant n'a pas accès à
  // la base de données pour les résoudre lui-même. Simple confort d'UI —
  // masquer une action qu'un utilisateur ne peut de toute façon pas
  // effectuer — la vérification qui fait autorité reste dans la Server
  // Action correspondante (src/app/actions/users.ts).
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}

// Tableau de gestion des utilisateurs (/administration/utilisateurs). Pas de
// pagination : les back-offices ciblés par ce template comptent typiquement
// quelques dizaines d'utilisateurs tout au plus. Si ça devait grossir,
// TanStack Table (tri, filtrage, pagination côté client ou serveur) est la
// voie d'évolution naturelle plutôt que de réinventer ces mécanismes ici.
//
// Création et modification vivent sur des pages dédiées
// (/administration/utilisateurs/nouveau et /[id]), pas dans des Dialog :
// préférence durable du projet — un formulaire mérite une page organisée en
// sections (Card), un Dialog/AlertDialog reste réservé aux confirmations
// destructrices. Voir DeleteUserAlertDialog ci-dessous pour la suppression,
// qui EN est une et garde donc son AlertDialog : reste ouvert avec une
// Alert inline en cas d'erreur (garde-fous serveur : dernier administrateur,
// auto-suppression), ne se ferme que sur succès (toast + rafraîchissement).
export function UsersTable({
  users,
  currentUserId,
  canCreate,
  canUpdate,
  canDelete,
}: UsersTableProps) {
  const router = useRouter()
  const [deletingUser, setDeletingUser] = useState<UserRow | null>(null)
  // Aucune des deux actions de ligne n'est accordée : la colonne "Actions"
  // elle-même n'a plus lieu d'exister (voir le commentaire de
  // `UsersTableProps` ci-dessus).
  const showActionsColumn = canUpdate || canDelete

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Utilisateurs</CardTitle>
          <CardDescription>
            Comptes ayant accès à cette application.
          </CardDescription>
        </div>
        {canCreate && (
          <Button
            size="sm"
            render={<Link href="/administration/utilisateurs/nouveau" />}
          >
            <PlusIcon />
            Créer un utilisateur
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Courriel</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Créé le</TableHead>
              {showActionsColumn && (
                <TableHead className="text-right">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={showActionsColumn ? 5 : 4}
                  className="text-center text-muted-foreground"
                >
                  Aucun utilisateur.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.name}
                    {user.id === currentUserId && (
                      <span className="ml-1.5 font-normal text-muted-foreground">
                        (vous)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell>{user.roleName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {dateFormatter.format(user.createdAt)}
                  </TableCell>
                  {showActionsColumn && (
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon-sm">
                              <MoreHorizontalIcon />
                              <span className="sr-only">
                                Actions pour {user.name}
                              </span>
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          {canUpdate && (
                            <DropdownMenuItem
                              render={
                                <Link
                                  href={`/administration/utilisateurs/${user.id}`}
                                />
                              }
                            >
                              Modifier
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDeletingUser(user)}
                            >
                              Supprimer
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      {deletingUser && (
        <DeleteUserAlertDialog
          user={deletingUser}
          onOpenChange={(open) => !open && setDeletingUser(null)}
          onDeleted={() => {
            setDeletingUser(null)
            router.refresh()
          }}
        />
      )}
    </Card>
  )
}

type DeleteUserAlertDialogProps = {
  user: UserRow
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}

function DeleteUserAlertDialog({
  user,
  onOpenChange,
  onDeleted,
}: DeleteUserAlertDialogProps) {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setIsPending(true)
    setError(null)
    try {
      const result = await deleteUserAction(user.id)
      if (result?.error) {
        setError(result.error)
        return
      }
      toast.success("L'utilisateur a été supprimé.")
      onDeleted()
    } finally {
      setIsPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer {user.name} ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action est irréversible depuis cette interface. L&apos;accès
            du compte associé au courriel <strong>{user.email}</strong> sera
            immédiatement révoqué (déconnexion, connexion impossible) et il
            disparaîtra de cette liste.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>{error}</AlertTitle>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? "Suppression..." : "Supprimer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
