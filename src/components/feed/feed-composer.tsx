"use client"

import { useState, useTransition } from "react"
import { AwardIcon, BarChart3Icon, CircleAlertIcon, MessageSquareIcon, PlusIcon, XIcon } from "lucide-react"

import {
  createKudosPostAction,
  createMessagePostAction,
  createPollPostAction,
} from "@/app/actions/feed"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export type ComposerUser = {
  id: string
  name: string
  image: string | null
}

type ComposerTab = "message" | "kudos" | "poll"

type FeedComposerProps = {
  groupId: string | null
  currentUser: { name: string; image: string | null }
  employees: ComposerUser[]
  onPosted?: () => void
}

const TABS: { id: ComposerTab; label: string; icon: typeof MessageSquareIcon }[] = [
  { id: "message", label: "Message", icon: MessageSquareIcon },
  { id: "kudos", label: "Bon coup", icon: AwardIcon },
  { id: "poll", label: "Sondage", icon: BarChart3Icon },
]

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

// Composeur du fil (/fil et /groupes/[id], voir groupId) : un message, un
// bon coup (destinataire + message, rendu distinct) ou un sondage (question
// + 2 à 5 options). Un seul composant pour les trois, plutôt que trois
// formulaires séparés : ils partagent la zone de texte et les boutons
// d'action, seule la partie spécifique change selon l'onglet actif.
export function FeedComposer({ groupId, currentUser, employees, onPosted }: FeedComposerProps) {
  const [tab, setTab] = useState<ComposerTab>("message")
  const [body, setBody] = useState("")
  const [kudosRecipientId, setKudosRecipientId] = useState("")
  const [options, setOptions] = useState(["", ""])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function reset() {
    setBody("")
    setKudosRecipientId("")
    setOptions(["", ""])
  }

  function handleTabChange(next: ComposerTab) {
    setTab(next)
    setError(null)
  }

  function handleSubmit() {
    setError(null)

    if (tab === "message") {
      startTransition(async () => {
        const result = await createMessagePostAction({ groupId, body })
        if (result.error) {
          setError(result.error)
          return
        }
        reset()
        onPosted?.()
      })
      return
    }

    if (tab === "kudos") {
      if (!kudosRecipientId) {
        setError("Choisissez un destinataire.")
        return
      }
      startTransition(async () => {
        const result = await createKudosPostAction({ groupId, body, kudosRecipientId })
        if (result.error) {
          setError(result.error)
          return
        }
        reset()
        onPosted?.()
      })
      return
    }

    const trimmedOptions = options.map((option) => option.trim()).filter(Boolean)
    startTransition(async () => {
      const result = await createPollPostAction({ groupId, body, options: trimmedOptions })
      if (result.error) {
        setError(result.error)
        return
      }
      reset()
      onPosted?.()
    })
  }

  const canSubmit =
    body.trim().length > 0 &&
    (tab !== "kudos" || kudosRecipientId !== "") &&
    (tab !== "poll" || options.filter((option) => option.trim()).length >= 2)

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-4">
        <div className="inline-flex w-fit items-center gap-0.5 rounded-lg bg-muted p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => handleTabChange(id)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className={cn("size-4", tab === id && "text-primary")} />
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <Avatar className="mt-1">
            {currentUser.image ? <AvatarImage src={currentUser.image} alt={currentUser.name} /> : null}
            <AvatarFallback>{initials(currentUser.name)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col gap-3">
            {tab === "kudos" && (
              <Select
                value={kudosRecipientId}
                onValueChange={(value) => setKudosRecipientId(value ?? "")}
              >
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder="Féliciter qui ?" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={
                tab === "message"
                  ? "Quoi de neuf ?"
                  : tab === "kudos"
                    ? "Décrivez le bon coup…"
                    : "Posez votre question…"
              }
              className="min-h-20 resize-none border-none bg-muted/50 shadow-none focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/30"
            />

            {tab === "poll" && (
              <div className="flex flex-col gap-2">
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={option}
                      onChange={(event) => {
                        const next = [...options]
                        next[index] = event.target.value
                        setOptions(next)
                      }}
                      placeholder={`Choix ${index + 1}`}
                    />
                    {options.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        onClick={() => setOptions(options.filter((_, i) => i !== index))}
                      >
                        <XIcon className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {options.length < 5 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    onClick={() => setOptions([...options, ""])}
                  >
                    <PlusIcon className="size-4" />
                    Ajouter une option
                  </Button>
                )}
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <CircleAlertIcon />
                <AlertTitle>{error}</AlertTitle>
              </Alert>
            )}

            <div className="flex justify-end">
              <Button onClick={handleSubmit} disabled={!canSubmit || isPending}>
                Publier
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
