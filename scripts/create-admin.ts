/**
 * Crée le premier compte administrateur.
 *
 * L'inscription publique est désactivée (emailAndPassword.disableSignUp
 * dans src/lib/auth/index.ts) : ce script est donc la façon de créer des comptes
 * pour ce template. Mince enrobage autour de createUserWithPassword
 * (src/lib/auth/create-user.ts), qui fait le travail réel (hachage du mot de
 * passe, création du compte "credential" via l'adaptateur interne de Better
 * Auth) et qui est aussi utilisée par createUserAction pour les comptes
 * suivants, créés depuis /administration/utilisateurs.
 *
 * Utilisation :
 *   npm run create-admin -- --name "Alex Caron" --email alex@exemple.com --password "MotDePasse123!"
 *
 * Ou en mode interactif, sans arguments : le script demande les
 * informations une à une.
 */
import { createInterface } from "node:readline/promises"
import { stdin, stdout } from "node:process"

type Args = {
  name?: string
  email?: string
  password?: string
}

function parseArgs(): Args {
  const args: Args = {}
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--name") args.name = argv[++i]
    else if (arg === "--email") args.email = argv[++i]
    else if (arg === "--password") args.password = argv[++i]
  }
  return args
}

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout })
  try {
    return (await rl.question(question)).trim()
  } finally {
    rl.close()
  }
}

async function main() {
  // Charger .env AVANT d'importer la config Better Auth : src/db/index.ts
  // lit DATABASE_URL dès son import, donc l'import doit être différé
  // (dynamique) jusqu'après le chargement des variables d'environnement.
  try {
    process.loadEnvFile()
  } catch {
    // Pas de fichier .env trouvé (ex. variables déjà fournies par
    // l'environnement) : on continue avec l'environnement existant.
  }

  const { createUserWithPassword } = await import("@/lib/auth/create-user")

  const args = parseArgs()

  const name = args.name ?? (await prompt("Nom complet : "))
  const emailInput = args.email ?? (await prompt("Courriel : "))
  const password =
    args.password ?? (await prompt("Mot de passe (min. 8 caractères) : "))

  const email = emailInput.trim().toLowerCase()

  if (!name.trim() || !email || !password) {
    console.error(
      "Erreur : le nom, le courriel et le mot de passe sont requis.",
    )
    process.exit(1)
  }

  if (password.length < 8) {
    console.error(
      "Erreur : le mot de passe doit contenir au moins 8 caractères.",
    )
    process.exit(1)
  }

  try {
    const user = await createUserWithPassword({
      name: name.trim(),
      email,
      password,
      role: "admin",
      // Aucune session : ce script est exécuté hors de toute application
      // (voir le commentaire d'en-tête), l'entrée du journal d'audit est
      // donc attribuée à "Système" (voir resolveActorLabel dans
      // src/lib/audit/audit.ts).
      actorId: null,
    })

    console.log("")
    console.log(
      `Compte administrateur créé avec succès : ${user.email} (rôle : admin).`,
    )
    console.log("Vous pouvez maintenant vous connecter avec ce compte sur /.")
    process.exit(0)
  } catch (error) {
    console.error(
      `Erreur : ${error instanceof Error ? error.message : String(error)}`,
    )
    process.exit(1)
  }
}

main().catch((error: unknown) => {
  console.error(
    "Erreur inattendue lors de la création de l'administrateur :",
    error,
  )
  process.exit(1)
})
