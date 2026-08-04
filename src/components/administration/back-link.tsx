import Link from "next/link"
import { ChevronLeftIcon } from "lucide-react"

type BackLinkProps = {
  href: string
  label: string
}

// Repère de navigation affiché au-dessus du titre de chaque page de
// création/édition sous /administration (utilisateurs et rôles) — pas un
// vrai fil d'Ariane multi-niveaux, juste un raccourci vers la page liste
// dont la page courante dépend.
export function BackLink({ href, label }: BackLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ChevronLeftIcon className="size-4" />
      {label}
    </Link>
  )
}
