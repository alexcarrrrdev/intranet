"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ChevronRightIcon,
  LayoutDashboard,
  Settings2Icon,
  type LucideIcon,
} from "lucide-react"

import { BrandMark } from "@/components/brand-mark"
import { NavUser } from "@/components/nav-user"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

// Chaque entrée peut déclarer la permission qu'elle exige. Une entrée dont
// la permission n'est pas accordée est masquée : on n'affiche jamais un
// lien qui mènerait à un « Accès refusé ». Ce n'est qu'un confort d'UI — la
// sécurité réelle est appliquée côté serveur, dans la page et dans la
// Server Action correspondantes.
//
// Les permissions sont désormais résolues en base de données (voir
// src/lib/auth/permissions.ts), donc asynchrones — incompatible avec un
// composant client comme celui-ci, qui doit rester synchrone. Le layout du
// tableau de bord (src/app/(dashboard)/layout.tsx) résout donc l'ensemble
// des permissions de l'utilisateur côté serveur et les transmet ici sous
// forme de tableau de chaînes ("resource:action") : ce composant se
// contente de les tester (inclusion dans le tableau), une opération pure et
// synchrone.
type NavLeaf = {
  title: string
  href: string
  requiredPermission?: string
}

type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  requiredPermission?: string
  // Présent uniquement pour les entrées avec sous-menu (ex. "Administration").
  // Ajouter une future page à ce sous-menu (ex. "Utilisateurs", "Journal
  // d'audit") revient à ajouter une entrée à ce tableau, avec la permission
  // qu'elle exige.
  items?: NavLeaf[]
}

// Navigation principale du back-office. Ajouter une entrée de premier
// niveau ici suffit à l'afficher dans la barre latérale.
const navItems: NavItem[] = [
  { title: "Tableau de bord", href: "/tableau-de-bord", icon: LayoutDashboard },
]

// Groupe "Administration". Le groupe entier disparaît si aucune de ses
// entrées n'est accessible à l'utilisateur.
const administrationNavItem: NavItem = {
  title: "Administration",
  href: "/administration",
  icon: Settings2Icon,
  items: [
    {
      title: "Utilisateurs",
      href: "/administration/utilisateurs",
      requiredPermission: "user:read",
    },
    {
      title: "Rôles",
      href: "/administration/roles",
      requiredPermission: "role:read",
    },
    {
      title: "Général",
      href: "/administration/general",
      requiredPermission: "settings:update",
    },
    {
      title: "Journal",
      href: "/administration/journal",
      requiredPermission: "audit:read",
    },
  ],
}

type SidebarUser = {
  name: string
  email: string
}

type AppSidebarProps = {
  user: SidebarUser
  // Permissions accordées à l'utilisateur courant ("resource:action"),
  // calculées côté serveur par le layout — voir le commentaire de
  // `requiredPermission` ci-dessus.
  permissions: string[]
  appName: string
  hasLogo: boolean
  logoVersion: number
}

// Filtre la navigation selon les permissions de l'utilisateur : les entrées
// interdites sont retirées, et un groupe vidé de toutes ses entrées
// disparaît lui aussi. Pure et synchrone : testable sans session ni base de
// données (voir src/components/app-sidebar.test.tsx).
function visibleNavItems(permissions: string[]): NavItem[] {
  const granted = new Set(permissions)
  const isAllowed = (requiredPermission?: string) =>
    !requiredPermission || granted.has(requiredPermission)

  return [...navItems, administrationNavItem]
    .map((item) =>
      item.items
        ? {
            ...item,
            items: item.items.filter((leaf) => isAllowed(leaf.requiredPermission)),
          }
        : item,
    )
    .filter((item) =>
      item.items ? item.items.length > 0 : isAllowed(item.requiredPermission),
    )
}

export function AppSidebar({
  user,
  permissions,
  appName,
  hasLogo,
  logoVersion,
}: AppSidebarProps) {
  const pathname = usePathname()
  const items = visibleNavItems(permissions)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/tableau-de-bord" />}>
              <BrandMark hasLogo={hasLogo} logoVersion={logoVersion} className="size-8" />
              <span className="truncate text-sm font-semibold">{appName}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) =>
                item.items ? (
                  <NavItemWithSubmenu
                    key={item.href}
                    item={item}
                    items={item.items}
                    pathname={pathname}
                  />
                ) : (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      tooltip={item.title}
                      isActive={pathname.startsWith(item.href)}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ),
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}

type NavItemWithSubmenuProps = {
  item: NavItem
  items: NavLeaf[]
  pathname: string
}

function NavItemWithSubmenu({ item, items, pathname }: NavItemWithSubmenuProps) {
  const isActive = pathname.startsWith(item.href)
  // Ouvert par défaut si la route courante est dans ce sous-menu, et
  // s'ouvre automatiquement si on y navigue ensuite (le composant ne
  // remonte pas lors d'une navigation côté client au sein du layout).
  // Ajustement du state pendant le rendu plutôt que dans un effet — voir
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [open, setOpen] = useState(isActive)
  const [prevIsActive, setPrevIsActive] = useState(isActive)
  if (isActive !== prevIsActive) {
    setPrevIsActive(isActive)
    if (isActive) setOpen(true)
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <SidebarMenuItem>
        <CollapsibleTrigger
          render={
            <SidebarMenuButton
              tooltip={item.title}
              isActive={isActive}
              className="group/nav-collapsible"
            />
          }
        >
          <item.icon />
          <span>{item.title}</span>
          <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-[panel-open]/nav-collapsible:rotate-90" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {items.map((subItem) => (
              <SidebarMenuSubItem key={subItem.href}>
                <SidebarMenuSubButton
                  render={<Link href={subItem.href} />}
                  isActive={pathname === subItem.href}
                >
                  <span>{subItem.title}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}
