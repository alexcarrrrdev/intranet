"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { AUDIT_ACTIONS } from "@/lib/audit/actions"
import { formatAuditDetails } from "@/lib/audit/format-details"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// Formate la date ET l'heure, contrairement aux autres tableaux
// d'administration (voir src/components/administration/users-table.tsx) :
// l'ordre chronologique fin est le principal intérêt d'un journal d'audit,
// une simple date ne suffit pas à distinguer deux entrées survenues le même
// jour.
const dateTimeFormatter = new Intl.DateTimeFormat("fr-CA", {
  dateStyle: "long",
  timeStyle: "short",
})

export type AuditLogRow = {
  id: string
  createdAt: Date
  actorLabel: string
  action: string
  targetLabel: string
  details: unknown
}

export type AuditActorOption = {
  id: string
  label: string
}

type AuditLogTableProps = {
  entries: AuditLogRow[]
  total: number
  page: number
  perPage: number
  actionFilter?: string
  actorFilter?: string
  actors: AuditActorOption[]
}

const ALL_VALUE = "all"

// Tableau du journal d'audit (/administration/journal). Contrairement aux
// autres tableaux d'administration, il est PAGINÉ (le journal grossit sans
// fin, voir src/lib/audit/audit.ts — write-only, aucune purge automatique) et
// n'a AUCUNE colonne d'actions : c'est un historique en lecture seule, il n'y
// a rien à modifier ni supprimer depuis cette page (voir le commentaire de
// `auditLog` dans src/db/schema.ts).
//
// Les filtres (action, acteur) et la pagination sont portés par l'URL
// (`?action=`, `?acteur=`, `?page=`), pas par un état local : la page
// elle-même (src/app/(dashboard)/administration/journal/page.tsx) est un
// composant serveur qui relit `listAuditEntries` à chaque navigation — ce
// composant-ci ne fait que construire les URL correspondantes.
export function AuditLogTable({
  entries,
  total,
  page,
  perPage,
  actionFilter,
  actorFilter,
  actors,
}: AuditLogTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  function navigate(patch: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) params.delete(key)
      else params.set(key, value)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  // Tout changement de filtre repart à la page 1 : la page actuelle pourrait
  // ne plus exister pour le nouveau filtre (ex. moins de résultats). `value`
  // peut être `null` (désélection, voir SelectRoot.Props côté @base-ui/react)
  // — traité comme ALL_VALUE, exactement comme si "Tous/Toutes" avait été
  // choisi explicitement.
  function handleFilterChange(key: "action" | "acteur", value: string | null) {
    const resolved = value ?? ALL_VALUE
    navigate({ [key]: resolved === ALL_VALUE ? undefined : resolved, page: undefined })
  }

  function goToPage(nextPage: number) {
    navigate({ page: nextPage > 1 ? String(nextPage) : undefined })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Journal d&apos;audit</CardTitle>
        <CardDescription>
          Historique des actions administratives effectuées dans
          l&apos;application.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Select
            value={actionFilter ?? ALL_VALUE}
            onValueChange={(value) => handleFilterChange("action", value)}
          >
            <SelectTrigger size="sm" className="w-56">
              {/* Fonction de rendu explicite (comme user-edit-form.tsx) plutôt
              que de laisser SelectValue déduire le libellé du SelectItem
              correspondant : la valeur initiale vient de l'URL (?action=),
              pas d'une sélection dans le menu déjà ouvert une fois — Base UI
              n'a donc pas encore « vu » l'item et afficherait sinon la clé
              technique brute (ex. "user.update") au lieu de son libellé
              français. */}
              <SelectValue placeholder="Toutes les actions">
                {(value: string | null) =>
                  value && value !== ALL_VALUE
                    ? (AUDIT_ACTIONS[value as keyof typeof AUDIT_ACTIONS] ?? value)
                    : "Toutes les actions"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Toutes les actions</SelectItem>
              {Object.entries(AUDIT_ACTIONS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={actorFilter ?? ALL_VALUE}
            onValueChange={(value) => handleFilterChange("acteur", value)}
          >
            <SelectTrigger size="sm" className="w-56">
              {/* Même raison que le filtre "Action" ci-dessus. */}
              <SelectValue placeholder="Tous les acteurs">
                {(value: string | null) =>
                  value && value !== ALL_VALUE
                    ? (actors.find((actor) => actor.id === value)?.label ?? value)
                    : "Tous les acteurs"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Tous les acteurs</SelectItem>
              {actors.map((actor) => (
                <SelectItem key={actor.id} value={actor.id}>
                  {actor.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Acteur</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Cible</TableHead>
              <TableHead>Détails</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Aucune entrée.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => {
                const details = formatAuditDetails(entry.action, entry.details)
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {dateTimeFormatter.format(entry.createdAt)}
                    </TableCell>
                    <TableCell className="font-medium">{entry.actorLabel}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                        {AUDIT_ACTIONS[entry.action as keyof typeof AUDIT_ACTIONS] ??
                          entry.action}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-64 min-w-40 whitespace-normal break-words text-muted-foreground">
                      {entry.targetLabel || "—"}
                    </TableCell>
                    <TableCell className="max-w-80 min-w-48 whitespace-normal break-words text-muted-foreground">
                      {details.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {details.map((line, index) => (
                            <span key={index}>{line}</span>
                          ))}
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Page {page} sur {totalPages} ({total} entrée{total > 1 ? "s" : ""})
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
            >
              Suivant
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
