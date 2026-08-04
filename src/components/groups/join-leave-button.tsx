"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { joinGroupAction, leaveGroupAction } from "@/app/actions/groups"
import { Button } from "@/components/ui/button"

type JoinLeaveButtonProps = {
  groupId: string
  isMember: boolean
  size?: "sm" | "default"
}

// Bouton Rejoindre/Quitter un groupe : ouvert à tout utilisateur connecté
// (groupes ouverts, v1), utilisé à la fois par la grille (/groupes) et
// l'en-tête de détail (/groupes/[id]).
export function JoinLeaveButton({ groupId, isMember: initialIsMember, size = "sm" }: JoinLeaveButtonProps) {
  const router = useRouter()
  const [isMember, setIsMember] = useState(initialIsMember)
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    const wasMember = isMember
    setIsMember(!wasMember)
    startTransition(async () => {
      const result = wasMember
        ? await leaveGroupAction({ groupId })
        : await joinGroupAction({ groupId })
      if (result.error) {
        setIsMember(wasMember)
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <Button
      variant={isMember ? "outline" : "default"}
      size={size}
      onClick={handleClick}
      disabled={isPending}
    >
      {isMember ? "Quitter" : "Rejoindre"}
    </Button>
  )
}
