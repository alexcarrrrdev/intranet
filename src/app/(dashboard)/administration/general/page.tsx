import { redirect } from "next/navigation"

import { getCurrentSession } from "@/lib/auth/session"
import {
  canManageAppSettings,
  getAppSettingsSummary,
} from "@/lib/settings/app-settings"
import { AppNameForm } from "@/components/administration/app-name-form"
import { LogoUploadForm } from "@/components/administration/logo-upload-form"
import { PrimaryColorForm } from "@/components/administration/primary-color-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// Vérification qui fait autorité : un utilisateur sans la permission
// `settings:update` ne doit pouvoir ni voir ni soumettre ce formulaire,
// même s'il navigue directement vers cette URL — le fait que l'entrée de
// menu « Administration » soit cachée (voir src/components/app-sidebar.tsx)
// n'est qu'un confort d'UI, pas une mesure de sécurité.
export default async function AdministrationGeneralPage() {
  const session = await getCurrentSession()

  if (!session) {
    redirect("/")
  }

  if (!(await canManageAppSettings(session.user))) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Accès refusé</CardTitle>
          <CardDescription>
            Vous n&apos;avez pas la permission d&apos;accéder à cette page.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const { appName, hasLogo, logoVersion, primaryColor } =
    await getAppSettingsSummary()

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Général</CardTitle>
          <CardDescription>
            Paramètres généraux de l&apos;application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AppNameForm defaultAppName={appName} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Couleur principale</CardTitle>
          <CardDescription>
            Couleur utilisée pour les boutons, l&apos;anneau de focus et
            l&apos;élément actif de la barre latérale — sur l&apos;ensemble
            de l&apos;application, y compris la page de connexion. Le
            contraste du texte et une variante adaptée au mode sombre sont
            calculés automatiquement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PrimaryColorForm defaultPrimaryColor={primaryColor} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
          <CardDescription>
            Logo personnalisé affiché dans la barre latérale et sur les
            pages de connexion.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LogoUploadForm hasLogo={hasLogo} logoVersion={logoVersion} />
        </CardContent>
      </Card>
    </div>
  )
}
