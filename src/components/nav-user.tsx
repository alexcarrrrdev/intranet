"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronsUpDownIcon, LogOutIcon, Settings2Icon, UserIcon } from "lucide-react"

import { signOut } from "@/lib/auth/client"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

type NavUserProps = {
  user: {
    name: string
    email: string
  }
}

// Déduit des initiales à partir du nom (ex. "Alex Caron" -> "AC"), ou à
// défaut à partir du courriel (ex. "alex@exemple.com" -> "A").
export function getInitials(name: string, email: string) {
  const trimmedName = name.trim()
  if (trimmedName) {
    const parts = trimmedName.split(/\s+/)
    const initials = parts
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
    if (initials) return initials.toUpperCase()
  }
  return email.slice(0, 1).toUpperCase()
}

export function NavUser({ user }: NavUserProps) {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const initials = getInitials(user.name, user.email)

  async function handleSignOut() {
    await signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
              />
            }
          >
            <Avatar className="rounded-lg">
              <AvatarFallback className="rounded-lg">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            </div>
            <ChevronsUpDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side={isMobile ? "bottom" : "right"}
            className="w-56"
          >
            {/* Base UI exige un Group parent pour un GroupLabel. */}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="grid text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {user.name}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/profil" />}>
              <UserIcon />
              Profil
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/parametres" />}>
              <Settings2Icon />
              Paramètres
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
              <LogOutIcon />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
