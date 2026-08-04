"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

export type PermissionCatalogAction = {
  action: string
  label: string
}

export type PermissionCatalogEntry = {
  resource: string
  label: string
  actions: PermissionCatalogAction[]
}

type PermissionMatrixProps = {
  catalog: PermissionCatalogEntry[]
  value: string[]
  onChange: (value: string[]) => void
  disabled?: boolean
}

// Matrice ressource × action utilisée par les dialogues de création/édition
// de rôle (/administration/roles) : une section par ressource du catalogue
// (`statement`, voir src/lib/auth/permissions.ts), une case à cocher par
// action qu'elle accepte. Le catalogue est transmis en props — calculé côté
// serveur, voir src/app/(dashboard)/administration/roles/page.tsx — plutôt
// qu'importé directement ici : src/lib/auth/permissions.ts touche la base de
// données (via getPermissionsForRole), donc ne peut pas être importé depuis
// un composant client (même raisonnement que src/lib/auth/slug.ts pour le
// slug des rôles).
export function PermissionMatrix({
  catalog,
  value,
  onChange,
  disabled,
}: PermissionMatrixProps) {
  const granted = new Set(value)

  function toggle(permission: string, checked: boolean) {
    const next = new Set(granted)
    if (checked) {
      next.add(permission)
    } else {
      next.delete(permission)
    }
    onChange(Array.from(next))
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-3">
      {catalog.map((entry) => (
        <div key={entry.resource} className="flex flex-col gap-2">
          <span className="text-sm font-medium">{entry.label}</span>
          <div className="flex flex-wrap gap-4">
            {entry.actions.map((action) => {
              const permission = `${entry.resource}:${action.action}`
              return (
                <Label
                  key={permission}
                  className="flex items-center gap-2 font-normal"
                >
                  <Checkbox
                    checked={granted.has(permission)}
                    onCheckedChange={(checked) =>
                      toggle(permission, checked === true)
                    }
                    disabled={disabled}
                  />
                  {action.label}
                </Label>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
