"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontalIcon } from "lucide-react"
import { toast } from "sonner"

import { deleteGroupAction } from "@/app/actions/groups"
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
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { JoinLeaveButton } from "@/components/groups/join-leave-button"
import type { GroupDetail } from "@/lib/groups/groups"

type GroupDetailHeaderProps = {
  group: GroupDetail
  canManage: boolean
}

// En-tête de contexte du fil filtré par groupe (/fil?groupe=…) : nom,
// description, nb de membres, Rejoindre/Quitter, suppression (group:manage).
// La redirection après suppression revient à /fil (désélectionne le
// filtre), seul point de sortie possible depuis un groupe qui vient d'être
// supprimé.
export function GroupDetailHeader({ group, canManage }: GroupDetailHeaderProps) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      const result = await deleteGroupAction({ groupId: group.id })
      if (result.error) {
        setError(result.error)
        return
      }
      toast.success("Le groupe a été supprimé.")
      router.push("/fil")
    })
  }

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 py-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-lg font-semibold">{group.name}</h1>
          {group.description && (
            <p className="text-sm text-muted-foreground">{group.description}</p>
          )}
          <span className="text-xs text-muted-foreground">
            {group.memberCount} membre{group.memberCount > 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <JoinLeaveButton groupId={group.id} isMember={group.isMember} />
          {canManage && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon" className="size-8 shrink-0">
                      <MoreHorizontalIcon className="size-4" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem variant="destructive" onClick={() => setConfirmOpen(true)}>
                    Supprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer ce groupe ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      « {group.name} » et toutes ses publications seront définitivement
                      supprimés. Cette action est irréversible.
                      {error && <span className="mt-2 block text-destructive">{error}</span>}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(event) => {
                        event.preventDefault()
                        handleDelete()
                      }}
                      disabled={isPending}
                    >
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
