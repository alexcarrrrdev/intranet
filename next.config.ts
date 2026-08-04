import type { NextConfig } from "next";

// ---------------------------------------------------------------------------
// En-têtes de sécurité HTTP
// ---------------------------------------------------------------------------
// Appliqués à TOUTES les routes (pages ET API) via headers() dans
// next.config.ts — voir node_modules/next/dist/docs/01-app/03-api-reference/
// 05-config/01-next-config-js/headers.md.
//
// Approche retenue pour la CSP : script-src/style-src pragmatiques
// ('self' + 'unsafe-inline'), PAS de nonce généré dans le proxy.
//
// Next.js documente un mode « nonce » (voir node_modules/next/dist/docs/
// 01-app/02-guides/content-security-policy.md) où src/proxy.ts génère un
// nonce par requête et l'attache à la CSP + aux scripts. C'est le
// « gold standard », mais deux contraintes concrètes de ce projet le
// rendent peu adapté à un template :
//   1. Un nonce force le RENDU DYNAMIQUE de toutes les pages (plus de rendu
//      statique/ISR, PPR incompatible) — un coût élevé pour un template dont
//      le but est justement de rester simple à adapter par un client.
//   2. Même avec un nonce, `style-src` ne pourrait pas être strict : Sonner
//      (composant Toaster, src/components/ui/sonner.tsx) pose un attribut
//      `style="--normal-bg:...` directement sur le DOM. Un nonce CSP ne
//      s'applique JAMAIS aux attributs `style=""` (seulement aux balises
//      <style> et <link>), donc `style-src` aurait de toute façon besoin de
//      'unsafe-inline' (ou de 'unsafe-hashes', peu praticable ici car les
//      valeurs sont calculées dynamiquement). Le bénéfice du nonce ne
//      porterait donc que sur script-src, pour un coût architectural élevé.
//
// Conséquence assumée : 'unsafe-inline' affaiblit la protection XSS de la
// CSP (un script/style injecté inline ne serait pas bloqué par la CSP).
// La défense contre le XSS repose donc principalement sur :
//   - l'échappement automatique du JSX/React (pas de dangerouslySetInnerHTML
//     dans le code applicatif) ;
//   - la validation des entrées côté serveur (zod) ;
//   - les autres directives strictes ci-dessous (object-src, base-uri,
//     form-action, frame-ancestors, img-src, font-src) qui, elles,
//     restent pleinement efficaces et bloquent l'essentiel des vecteurs
//     d'exfiltration/chargement de ressources externes.
// Un client avec des exigences de sécurité plus strictes peut migrer vers
// l'approche nonce du guide Next.js ci-dessus (au prix de la dynamique
// forcée) — à envisager si Sonner est un jour retiré du template.
const isDev = process.env.NODE_ENV === "development";

// Directives de la Content-Security-Policy, une entrée par directive (plutôt
// qu'une seule chaîne géante) pour rester lisible et facile à ajuster par un
// projet client.
const cspDirectives: Record<string, string[]> = {
  // Origine par défaut pour toute ressource non couverte par une directive
  // plus spécifique ci-dessous.
  "default-src": ["'self'"],
  // Scripts : voir justification 'unsafe-inline' ci-dessus (theme script de
  // next-themes injecté en inline). 'unsafe-eval' uniquement en dev : React
  // s'en sert pour reconstruire les stacks d'erreurs serveur dans le
  // navigateur ; jamais utilisé en production par Next.js/React.
  "script-src": [
    "'self'",
    "'unsafe-inline'",
    ...(isDev ? ["'unsafe-eval'"] : []),
  ],
  // Styles : Tailwind v4 (styles injectés), React (style inline via props
  // `style`) et Sonner (variables CSS en attribut style=) en dépendent.
  "style-src": ["'self'", "'unsafe-inline'"],
  // Images : 'self' pour les assets statiques, blob:/data: pour les aperçus
  // générés côté client (aucune image distante : les avatars sont en
  // initiales uniquement, pas de <img> vers un domaine tiers).
  "img-src": ["'self'", "blob:", "data:"],
  // Polices : Geist est auto-hébergée via next/font, aucune police distante.
  "font-src": ["'self'"],
  // Bloque les plugins hérités (Flash, Java applets, etc.) — surface
  // d'attaque inutile pour ce back-office.
  "object-src": ["'none'"],
  // Empêche l'injection d'une balise <base> qui détournerait les URLs
  // relatives de la page (vecteur classique de contournement de CSP).
  "base-uri": ["'self'"],
  // Les formulaires (connexion, mot de passe oublié, etc.) ne peuvent
  // soumettre qu'à l'origine elle-même.
  "form-action": ["'self'"],
  // Personne ne doit pouvoir intégrer ce back-office dans un <iframe>,
  // ailleurs qu'ici — équivalent moderne (et prioritaire) de X-Frame-Options.
  "frame-ancestors": ["'none'"],
};

const contentSecurityPolicy = Object.entries(cspDirectives)
  .map(([directive, values]) => `${directive} ${values.join(" ")}`)
  .join("; ");

const securityHeaders = [
  {
    // Empêche le navigateur de deviner le Content-Type d'une ressource :
    // protège contre les attaques où un fichier uploadé serait interprété
    // comme du script/HTML plutôt que comme le type déclaré.
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Interdit toute intégration dans un <iframe> — c'est un back-office,
    // rien ne doit légitimement l'y intégrer (protection anti-clickjacking,
    // en complément de frame-ancestors pour les navigateurs plus anciens).
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    // Limite les informations envoyées dans l'en-tête Referer lors d'une
    // navigation vers un autre site : garde l'origine complète en même
    // origine, mais réduit à l'origine seule pour les requêtes cross-origin.
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Désactive l'accès à des API navigateur sensibles qu'aucune page de ce
    // template n'utilise, pour réduire la surface d'attaque même en cas de
    // script tiers compromis.
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    // Force HTTPS pour ce domaine et ses sous-domaines pendant 2 ans. Sans
    // effet en dev local (le navigateur ignore HSTS reçu en clair sur
    // http://localhost) : cet en-tête n'est réellement actif qu'en
    // production, derrière HTTPS.
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  {
    // Politique de sécurité du contenu : restreint les origines autorisées
    // pour scripts, styles, images, polices, formulaires, etc. Voir le
    // commentaire détaillé plus haut pour le choix de l'approche.
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Toutes les routes, y compris les routes API (ex. /api/auth/*) :
        // les en-têtes de sécurité doivent s'appliquer aussi aux réponses
        // JSON, pas seulement aux pages HTML.
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Route /logo (src/app/logo/route.ts) : sert le logo personnalisé
        // de l'application, potentiellement au format SVG (format actif,
        // pouvant contenir du script) — voir src/lib/settings/logo-validation.ts
        // pour la validation à l'upload, qui est une liste noire et non un
        // sanitizer complet. En défense en profondeur, un navigateur qui
        // ouvrirait cette réponse DIRECTEMENT (navigation vers /logo, pas
        // une simple balise <img>) doit la traiter comme une origine unique
        // isolée : `sandbox` bloque toute exécution de script, soumission
        // de formulaire ou popup, quoi qu'il arrive.
        //
        // Remplace ici (et non dans le Route Handler lui-même) la valeur de
        // Content-Security-Policy posée par l'entrée générale ci-dessus :
        // d'après le « Header Overriding Behavior » documenté (voir
        // node_modules/next/dist/docs/01-app/03-api-reference/05-config/
        // 01-next-config-js/headers.md), quand plusieurs entrées de ce
        // tableau `headers()` matchent la même route pour la même clé, la
        // DERNIÈRE l'emporte — et ceci s'applique aussi face à un en-tête de
        // même nom posé par le Route Handler lui-même, qui serait sinon
        // silencieusement écrasé par l'entrée générale ci-dessus.
        source: "/logo",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "sandbox",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
