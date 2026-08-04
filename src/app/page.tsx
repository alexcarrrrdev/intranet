import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { getCurrentSession } from "@/lib/auth/session"
import { BrandHeader } from "@/components/brand-header"
import { LoginForm } from "@/components/login-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Connexion",
}

export default async function ConnexionPage() {
  // Si l'utilisateur a déjà une session valide, inutile de lui montrer le
  // formulaire de connexion.
  const session = await getCurrentSession()

  if (session) {
    redirect("/tableau-de-bord")
  }

  return (
    <main className="flex min-h-svh flex-1 flex-col items-center justify-center gap-6 p-4">
      <BrandHeader />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Connexion</CardTitle>
          <CardDescription>
            Entrez vos identifiants pour accéder à votre espace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  )
}
