import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { getGrantedPermissions } from "@/lib/auth/permissions"
import { getCurrentSession } from "@/lib/auth/session"
import { getAppSettingsSummary } from "@/lib/settings/app-settings"
import { AppSidebar } from "@/components/app-sidebar"
import { TopbarTitle } from "@/components/topbar-title"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  // Vérification qui fait autorité : session réellement valide en base
  // (contrairement à src/proxy.ts, qui ne fait qu'une vérification optimiste
  // basée sur la présence du cookie).
  const session = await getCurrentSession()

  if (!session) {
    redirect("/")
  }

  const [{ appName, hasLogo, logoVersion }, permissions] = await Promise.all([
    getAppSettingsSummary(),
    getGrantedPermissions(session.user),
  ])

  return (
    <SidebarProvider>
      <AppSidebar
        user={session.user}
        permissions={Array.from(permissions)}
        appName={appName}
        hasLogo={hasLogo}
        logoVersion={logoVersion}
      />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
          <SidebarTrigger />
          <TopbarTitle />
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
