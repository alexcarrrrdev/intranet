"use client"

import { useMemo, useState } from "react"
import { SearchIcon, UsersIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export type DirectoryUser = {
  id: string
  name: string
  email: string
  image: string | null
  roleName: string
}

type DirectoryGridProps = {
  users: DirectoryUser[]
}

// Initiales de repli pour l'avatar (ex. "Marie Tremblay" → "MT"), même
// logique que le reste de l'application partout où `user.image` peut être
// absent.
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

// Grille du trombinoscope (/annuaire) avec recherche client (nom/courriel).
// Pas de recherche serveur : la liste complète est déjà chargée par la page
// (voir listUsers), filtrer côté client suffit pour l'échelle visée par ce
// template.
export function DirectoryGrid({ users }: DirectoryGridProps) {
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return users
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(normalized) ||
        user.email.toLowerCase().includes(normalized),
    )
  }, [users, query])

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-sm">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher un nom ou un courriel…"
          className="h-9 pl-8"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <UsersIcon className="size-8" />
            <p className="text-sm">
              {users.length === 0
                ? "Aucun utilisateur à afficher."
                : "Aucun utilisateur ne correspond à cette recherche."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((user) => (
            <Card key={user.id}>
              <CardContent className="flex items-center gap-3 py-4">
                <Avatar size="lg">
                  {user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
                  <AvatarFallback>{initials(user.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  <a
                    href={`mailto:${user.email}`}
                    className="block truncate text-xs text-muted-foreground hover:text-primary hover:underline"
                  >
                    {user.email}
                  </a>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {user.roleName}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
