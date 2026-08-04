import { ThemeSelector } from "@/components/settings/theme-selector"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// Préférences personnelles de l'utilisateur connecté (à distinguer des
// paramètres globaux de l'application, gérés par un administrateur sous
// /administration). Une Card par section : ajouter une future préférence
// (ex. densité d'affichage, langue) revient à ajouter une nouvelle Card ici.
export default function ParametresPage() {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Apparence</CardTitle>
          <CardDescription>
            Personnalisez l&apos;apparence de l&apos;interface.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeSelector />
        </CardContent>
      </Card>
    </div>
  )
}
