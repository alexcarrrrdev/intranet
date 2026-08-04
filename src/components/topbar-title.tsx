"use client"

import { usePathname } from "next/navigation"

// Titres exacts (routes sans segment dynamique), vérifiés en premier.
const exactTitles: Record<string, string> = {
  "/profil": "Profil",
  "/parametres": "Paramètres",
  "/fil": "Fil d'actualités",
  "/annonces": "Annonces",
  "/annuaire": "Annuaire",
  "/calendrier": "Calendrier",
  "/groupes": "Groupes",
  "/administration/utilisateurs": "Administration – Utilisateurs",
  "/administration/roles": "Administration – Rôles",
  "/administration/general": "Administration – Général",
  "/administration/journal": "Administration – Journal d'audit",
}

// Préfixes pour les routes imbriquées/dynamiques (pages de création et
// d'édition sous /administration/utilisateurs et /administration/roles,
// ex. /administration/utilisateurs/[id]) : testés dans l'ordre, seulement si
// aucun titre exact ci-dessus ne correspond. "nouveau" doit être vérifié
// avant le préfixe générique de sa propre section, dont il est un cas
// particulier (toute route commençant par ".../nouveau" commence aussi par
// "..."/", plus court).
const prefixTitles: [prefix: string, title: string][] = [
  [
    "/administration/utilisateurs/nouveau",
    "Administration – Nouvel utilisateur",
  ],
  [
    "/administration/utilisateurs/",
    "Administration – Modifier l'utilisateur",
  ],
  ["/administration/roles/nouveau", "Administration – Nouveau rôle"],
  ["/administration/roles/", "Administration – Modifier le rôle"],
  // /groupes/[id] : page de détail d'un groupe, garde le même titre que la
  // liste — cohérent avec le fait que le fil du groupe réutilise les mêmes
  // composants que /fil (voir le plan produit).
  ["/groupes/", "Groupes"],
]

export function TopbarTitle() {
  const pathname = usePathname()
  const title =
    exactTitles[pathname] ??
    prefixTitles.find(([prefix]) => pathname.startsWith(prefix))?.[1] ??
    "Intranet"

  return <h1 className="text-sm font-medium">{title}</h1>
}
