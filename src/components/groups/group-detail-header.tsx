"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LockIcon, MailIcon, MoreHorizontalIcon, UserPlusIcon } from "lucide-react"
import { toast } from "sonner"

import {
  acceptInvitationAction,
  declineInvitationAction,
  deleteGroupAction,
  inviteToGroupAction,
} from "@/app/actions/groups"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LeaveGroupButton } from "@/components/groups/join-leave-button"
import type { GroupDetail, InvitableUser } from "@/lib/groups/groups"

type GroupDetailHeaderProps = {
  group: GroupDetail
  canManage: boolean
  // Employés invitables (actifs, ni membres ni déjà invités) — `null`
  // quand l'utilisateur courant n'est pas membre (le bouton "Inviter" n'est
  // alors pas rendu, voir plus bas), pour éviter à /fil de charger cette
  // liste quand elle ne sert à rien.
  invitees: InvitableUser[] | null
}

// En-tête de contexte du fil filtré par groupe (/fil?groupe=…) : nom,
// description, nb de membres, puis un état parmi trois selon
// l'utilisateur courant — voir le plan produit "groupes sur invitation" :
//   - membre : bouton "Quitter" + "Inviter" (dialog de sélection d'employé)
//     + (si `canManage`) suppression du groupe ;
//   - invité (non membre) : bandeau "{Nom} vous a invité·e" avec
//     Accepter/Refuser ;
//   - ni l'un ni l'autre : état verrouillé, aucun bouton "Rejoindre" — ce
//     groupe est fermé, seule une invitation permet d'y entrer.
export function GroupDetailHeader({ group, canManage, invitees }: GroupDetailHeaderProps) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [invitationPending, setInvitationPending] = useState(false)

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

  function handleAccept() {
    setInvitationPending(true)
    startTransition(async () => {
      const result = await acceptInvitationAction({ groupId: group.id })
      setInvitationPending(false)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Vous avez rejoint le groupe.")
      router.refresh()
    })
  }

  function handleDecline() {
    setInvitationPending(true)
    startTransition(async () => {
      const result = await declineInvitationAction({ groupId: group.id })
      setInvitationPending(false)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Invitation refusée.")
      router.push("/fil")
    })
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-start justify-between gap-4">
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
            {group.isMember && (
              <>
                <InviteToGroupDialog groupId={group.id} invitees={invitees ?? []} />
                <LeaveGroupButton groupId={group.id} />
              </>
            )}
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
        </div>

        {!group.isMember && group.invitation && (
          <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/50 px-3 py-2">
            <span className="flex items-center gap-2 text-sm">
              <MailIcon className="size-4 shrink-0 text-primary" />
              <strong className="font-medium">{group.invitation.invitedByName}</strong> vous a
              invité·e à rejoindre ce groupe.
            </span>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="outline" onClick={handleDecline} disabled={invitationPending}>
                Refuser
              </Button>
              <Button size="sm" onClick={handleAccept} disabled={invitationPending}>
                Accepter
              </Button>
            </div>
          </div>
        )}

        {!group.isMember && !group.invitation && (
          <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
            <LockIcon className="size-4 shrink-0" />
            Ce groupe est sur invitation.
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Dialog d'invitation, réservé aux membres du groupe (revérifié côté
// serveur par inviteToGroupAction). La liste des employés invitables est
// chargée par le parent (/fil/page.tsx) plutôt qu'ici : ce composant est
// déjà `"use client"`, y ajouter un aller-retour réseau propre nécessiterait
// une route API dédiée pour un formulaire aussi simple.
function InviteToGroupDialog({ groupId, invitees }: { groupId: string; invitees: InvitableUser[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleInvite() {
    if (!selectedUserId) return
    setError(null)
    startTransition(async () => {
      const result = await inviteToGroupAction({ groupId, userId: selectedUserId })
      if (result.error) {
        setError(result.error)
        return
      }
      toast.success("Invitation envoyée.")
      setOpen(false)
      setSelectedUserId(undefined)
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setSelectedUserId(undefined)
          setError(null)
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <UserPlusIcon className="size-4" />
            Inviter
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Inviter un employé</DialogTitle>
          <DialogDescription>
            La personne invitée devra accepter avant de rejoindre le groupe.
          </DialogDescription>
        </DialogHeader>
        <Select
          value={selectedUserId}
          onValueChange={(value) => setSelectedUserId(value ?? undefined)}
        >
          <SelectTrigger className="w-full">
            <SelectValue
              placeholder={invitees.length === 0 ? "Aucun employé à inviter" : "Choisir un employé"}
            />
          </SelectTrigger>
          <SelectContent>
            {invitees.map((invitee) => (
              <SelectItem key={invitee.id} value={invitee.id}>
                {invitee.name} ({invitee.email})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button onClick={handleInvite} disabled={!selectedUserId || isPending}>
            Envoyer l&apos;invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
