import type { Metadata } from "next"

import { BrandHeader } from "@/components/brand-header"
import { ForgotPasswordForm } from "@/components/forgot-password-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Mot de passe oublié",
}

// Page désormais rendue dynamiquement (BrandHeader lit les paramètres en
// base) — voir le commentaire de src/components/brand-header.tsx.
export default async function MotDePasseOubliePage() {
  return (
    <main className="flex min-h-svh flex-1 flex-col items-center justify-center gap-6 p-4">
      <BrandHeader />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Mot de passe oublié</CardTitle>
          <CardDescription>
            Entrez votre courriel pour recevoir un lien de réinitialisation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm />
        </CardContent>
      </Card>
    </main>
  )
}
