"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
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
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { JoinLeaveButton } from "@/components/groups/join-leave-button"
import type { GroupListItem } from "@/lib/groups/groups"

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

type GroupCardProps = {
  group: GroupListItem
  canManage: boolean
}

// Carte d'un groupe (grille /groupes) : nom, description, nb de membres,
// avatars empilés (max 5), bouton Rejoindre/Quitter. Détenteurs de
// `group:manage` : menu de suppression.
export function GroupCard({ group, canManage }: GroupCardProps) {
  const router = useRouter()
  const [deleted, setDeleted] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (deleted) return null

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      const result = await deleteGroupAction({ groupId: group.id })
      if (result.error) {
        setError(result.error)
        return
      }
      setConfirmOpen(false)
      setDeleted(true)
      toast.success("Le groupe a été supprimé.")
      router.refresh()
    })
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/groupes/${group.id}`} className="min-w-0 flex-1">
            <h3 className="truncate font-medium hover:underline">{group.name}</h3>
          </Link>
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

        {group.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{group.description}</p>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {group.previewMembers.length > 0 ? (
              <AvatarGroup>
                {group.previewMembers.map((member) => (
                  <Avatar key={member.id} size="sm">
                    {member.image ? <AvatarImage src={member.image} alt={member.name} /> : null}
                    <AvatarFallback>{initials(member.name)}</AvatarFallback>
                  </Avatar>
                ))}
                {group.memberCount > group.previewMembers.length && (
                  <AvatarGroupCount>+{group.memberCount - group.previewMembers.length}</AvatarGroupCount>
                )}
              </AvatarGroup>
            ) : (
              <span className="text-xs text-muted-foreground">Aucun membre</span>
            )}
            <span className="text-xs text-muted-foreground">
              {group.memberCount} membre{group.memberCount > 1 ? "s" : ""}
            </span>
          </div>
          <JoinLeaveButton groupId={group.id} isMember={group.isMember} />
        </div>
      </CardContent>
    </Card>
  )
}
