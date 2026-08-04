import type { Metadata } from "next"

import { BrandHeader } from "@/components/brand-header"
import { ResetPasswordForm } from "@/components/reset-password-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Réinitialiser le mot de passe",
}

type ReinitialiserMotDePassePageProps = {
  searchParams: Promise<{ token?: string }>
}

export default async function ReinitialiserMotDePassePage({
  searchParams,
}: ReinitialiserMotDePassePageProps) {
  const { token } = await searchParams

  return (
    <main className="flex min-h-svh flex-1 flex-col items-center justify-center gap-6 p-4">
      <BrandHeader />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Réinitialiser le mot de passe</CardTitle>
          <CardDescription>
            Choisissez un nouveau mot de passe pour votre compte.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResetPasswordForm token={token} />
        </CardContent>
      </Card>
    </main>
  )
}
