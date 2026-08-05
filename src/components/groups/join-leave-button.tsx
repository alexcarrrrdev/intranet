"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { leaveGroupAction } from "@/app/actions/groups"
import { Button } from "@/components/ui/button"

type LeaveGroupButtonProps = {
  groupId: string
  size?: "sm" | "default"
}

// Bouton "Quitter" un groupe — rejoindre se fait désormais uniquement sur
// invitation (voir acceptInvitationAction), ce composant ne gère donc plus
// que la sortie d'un groupe dont l'utilisateur est déjà membre.
export function LeaveGroupButton({ groupId, size = "sm" }: LeaveGroupButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const result = await leaveGroupAction({ groupId })
      if (result.error) {
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <Button variant="outline" size={size} onClick={handleClick} disabled={isPending}>
      Quitter
    </Button>
  )
}
