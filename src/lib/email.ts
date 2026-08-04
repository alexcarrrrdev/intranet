/**
 * Module d'envoi de courriels.
 *
 * Aucun fournisseur n'est installé par défaut (pas de SDK Resend, pas de SMTP).
 * Tant qu'aucune variable d'environnement de fournisseur n'est configurée,
 * `sendEmail` se contente d'afficher le message complet (destinataire, sujet,
 * contenu, lien éventuel) dans la console du serveur, précédé d'un avis clair,
 * puis retourne comme si l'envoi avait réussi — pratique en développement.
 *
 * Pour brancher un vrai fournisseur plus tard (Resend, SMTP, etc.), il suffit
 * de modifier le corps de cette fonction : le reste de l'application (flux de
 * réinitialisation de mot de passe, etc.) n'a rien à changer.
 */

type SendEmailInput = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

// Adapter cette condition au fournisseur choisi (ex. RESEND_API_KEY, SMTP_HOST...).
function isEmailProviderConfigured(): boolean {
  return Boolean(process.env.EMAIL_PROVIDER_API_KEY);
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: SendEmailInput): Promise<void> {
  if (!isEmailProviderConfigured()) {
    console.log(
      "\n[courriel] Aucun fournisseur de courriel configuré — message affiché ci-dessous au lieu d'être envoyé :",
    );
    console.log(`[courriel] À : ${to}`);
    console.log(`[courriel] Sujet : ${subject}`);
    if (text) console.log(`[courriel] Texte :\n${text}`);
    if (html) console.log(`[courriel] HTML :\n${html}`);
    console.log("[courriel] Fin du message.\n");
    return;
  }

  // TODO : brancher ici un vrai fournisseur (ex. Resend, SMTP) une fois
  // EMAIL_PROVIDER_API_KEY (ou équivalent) configuré.
  throw new Error(
    "Un fournisseur de courriel est configuré, mais aucune intégration n'est implémentée dans src/lib/email.ts.",
  );
}
