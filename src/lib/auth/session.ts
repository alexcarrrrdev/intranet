import { cache } from "react"
import { headers } from "next/headers"

import { auth } from "@/lib/auth"

/**
 * Lit la session courante côté serveur.
 *
 * Mémorisé avec `cache()` de React : la session est vérifiée à la fois dans
 * le layout du tableau de bord et dans plusieurs pages (qui refont la
 * vérification pour ne pas dépendre du layout). Sans mémorisation, chaque
 * vérification déclencherait sa propre requête en base.
 *
 * La mémorisation ne dure que le temps d'une requête HTTP : deux requêtes
 * distinctes relisent bien la session. Les Server Actions, qui s'exécutent
 * chacune dans leur propre requête, peuvent donc l'utiliser sans risque de
 * lire une session périmée.
 */
export const getCurrentSession = cache(async function getCurrentSession() {
  return auth.api.getSession({ headers: await headers() })
})
