"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CircleAlertIcon } from "lucide-react"
import { toast } from "sonner"

import {
  revokeOtherSessionsAction,
  revokeSessionAction,
} from "@/app/actions/profile"
import { formatIpAddress } from "@/lib/ip-address"
import { describeUserAgent } from "@/lib/user-agent"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export type SessionSummary = {
  token: string
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  expiresAt: string
  isCurrent: boolean
}

type ActiveSessionsCardProps = {
  sessions: SessionSummary[]
  // Vrai si la liste des sessions n'a pas pu être chargée côté serveur
  // (voir src/app/(dashboard)/profil/page.tsx) — distingue ce cas de « zéro
  // session », qui ne devrait jamais arriver puisque la session courante
  // existe toujours.
  loadError?: boolean
}

const dateFormatter = new Intl.DateTimeFormat("fr-CA", {
  dateStyle: "medium",
  timeStyle: "short",
})

function formatDate(value: string): string {
  return dateFormatter.format(new Date(value))
}

export function ActiveSessionsCard({
  sessions: initialSessions,
  loadError = false,
}: ActiveSessionsCardProps) {
  const router = useRouter()
  const [sessions, setSessions] = useState(initialSessions)
  const [error, setError] = useState<string | null>(null)
  const [pendingToken, setPendingToken] = useState<string | null>(null)
  const [isPendingRevokeOthers, setIsPendingRevokeOthers] = useState(false)

  const otherSessionsCount = sessions.filter((s) => !s.isCurrent).length

  async function handleRevoke(token: string) {
    setPendingToken(token)
    setError(null)
    try {
      const result = await revokeSessionAction(token)
      if (result?.error) {
        setError(result.error)
        return
      }
      setSessions((prev) => prev.filter((s) => s.token !== token))
      toast.success("La session a été révoquée.")
      router.refresh()
    } finally {
      setPendingToken(null)
    }
  }

  async function handleRevokeOthers() {
    setIsPendingRevokeOthers(true)
    setError(null)
    try {
      const result = await revokeOtherSessionsAction()
      if (result?.error) {
        setError(result.error)
        return
      }
      setSessions((prev) => prev.filter((s) => s.isCurrent))
      toast.success("Vous avez été déconnecté de vos autres appareils.")
      router.refresh()
    } finally {
      setIsPendingRevokeOthers(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {(error || loadError) && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>
            {error ??
              "Impossible de charger vos sessions actives pour le moment."}
          </AlertTitle>
        </Alert>
      )}
      {sessions.length > 0 && (
        <ul className="flex flex-col gap-3">
          {sessions.map((session) => (
            <li
              key={session.token}
              className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-col gap-0.5 text-sm">
                <span className="flex flex-wrap items-center gap-2 font-medium">
                  {describeUserAgent(session.userAgent)}
                  {session.isCurrent && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      Session actuelle
                    </span>
                  )}
                </span>
                <span className="break-all text-muted-foreground">
                  {formatIpAddress(session.ipAddress)} · Connecté le{" "}
                  {formatDate(session.createdAt)}
                </span>
                <span className="text-xs text-muted-foreground">
                  Expire le {formatDate(session.expiresAt)}
                </span>
              </div>
              {!session.isCurrent && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  disabled={pendingToken === session.token}
                  onClick={() => handleRevoke(session.token)}
                >
                  {pendingToken === session.token
                    ? "Révocation..."
                    : "Révoquer"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {sessions.length === 0 && !loadError && (
        <p className="text-sm text-muted-foreground">
          Aucune session active trouvée.
        </p>
      )}
      <div>
        <Button
          variant="outline"
          disabled={otherSessionsCount === 0 || isPendingRevokeOthers}
          onClick={handleRevokeOthers}
        >
          {isPendingRevokeOthers
            ? "Déconnexion en cours..."
            : "Se déconnecter partout ailleurs"}
        </Button>
      </div>
    </div>
  )
}
