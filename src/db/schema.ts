import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// Type Postgres `bytea` (données binaires), utilisé ci-dessous pour stocker
// le logo personnalisé de l'application directement en base plutôt que sur
// disque ou dans un stockage objet externe — évite une dépendance
// supplémentaire pour un template dont la taille de fichier est plafonnée à
// 1 Mo (voir src/lib/settings/logo-validation.ts). Drizzle 0.45 n'a pas de
// colonne `bytea` intégrée pour Postgres (contrairement à MySQL/SQLite) ; on
// la déclare donc via `customType` (voir
// node_modules/drizzle-orm/pg-core/columns/custom.d.ts). Le driver `pg`
// désérialise nativement une colonne bytea en `Buffer` Node, donc aucune
// fonction `toDriver`/`fromDriver` n'est nécessaire ici.
const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

// Rôles applicatifs, gérés dynamiquement depuis /administration/utilisateurs
// (voir src/lib/auth/roles.ts). `id` est le slug utilisé comme valeur de
// `user.role` ci-dessous (ex. "admin", "member", "comptable"). Deux rôles
// « système » sont créés par la migration 0005 (voir drizzle/0005_*.sql) :
// "admin" et "member" — ils ne peuvent pas être supprimés, et "admin" ne
// peut pas être modifié (voir src/lib/auth/roles.ts). `is_system` distingue
// ces rôles des rôles personnalisés créés ensuite par un administrateur.
export const role = pgTable("role", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  isSystem: boolean("is_system").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

// Permissions accordées à chaque rôle, une rangée par couple (rôle,
// permission). `permission` suit le format "ressource:action" (ex.
// "user:create"), dont le catalogue complet est déclaré dans `statement`
// (src/lib/auth/permissions.ts) — cette table ne fait qu'associer des
// chaînes à un rôle, sans contrainte au niveau SQL sur les valeurs
// possibles ; la validation contre le catalogue se fait dans
// src/lib/auth/roles.ts.
//
// Le rôle "admin" n'a volontairement AUCUNE rangée ici : il a accès à tout
// par un court-circuit dans le code (voir getPermissionsForRole dans
// src/lib/auth/permissions.ts), y compris aux ressources ajoutées plus tard
// sans migration nécessaire.
export const rolePermission = pgTable(
  "role_permission",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => role.id, { onDelete: "cascade" }),
    permission: text("permission").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.roleId, table.permission] }),
  ],
);

// Tables requises par Better Auth (authentification, sessions, comptes,
// jetons de vérification, compteurs de limitation de débit). Générées via
// `npx @better-auth/cli generate` à partir de la configuration de
// src/lib/auth/index.ts — si cette configuration change (ex. ajout d'un champ),
// régénérer plutôt que d'éditer à la main.
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  // Rôle applicatif (voir src/lib/auth/permissions.ts et
  // src/lib/auth/roles.ts). Par défaut "member" ; le premier compte "admin"
  // est créé via `npm run create-admin`. Référence `role.id` avec ON DELETE
  // RESTRICT : un rôle encore utilisé par au moins un utilisateur ne peut
  // pas être supprimé (même garde-fou appliqué en code dans
  // src/lib/auth/roles.ts, mais imposé ici aussi au niveau base de données).
  role: text("role")
    .default("member")
    .notNull()
    .references(() => role.id, { onDelete: "restrict" }),
  // Photo de profil personnalisée (facultative) : octets bruts de l'image +
  // type MIME déclaré à l'upload, même patron que `appSettings.logo`/
  // `logoMimeType` ci-dessus (voir aussi la validation dans
  // src/lib/settings/avatar-validation.ts, plafonnée à 10 Mo — plus
  // permissive que le logo car téléversée par chaque utilisateur, pas
  // seulement un administrateur). Les deux colonnes sont NULL tant qu'aucune
  // photo n'a été téléversée, ou de nouveau après un retrait — `image`
  // ci-dessus retombe alors sur `null` et l'application affiche les
  // initiales (voir src/components/nav-user.tsx, getInitials). Servies par
  // src/app/avatar/[userId]/route.ts, jamais lues directement ailleurs.
  avatar: bytea("avatar"),
  avatarMimeType: text("avatar_mime_type"),
  // Suppression douce (soft delete) : NULL tant que le compte est actif, ou
  // la date de suppression sinon (voir src/lib/auth/users.ts, `deleteUser`).
  // La rangée reste en base — ses sessions sont supprimées explicitement au
  // moment de la suppression (voir le commentaire de `deleteUser`), et son
  // courriel reste réservé (toujours contraint par `unique()` ci-dessus) :
  // aucune restauration via l'interface pour l'instant, seulement une
  // opération manuelle en base (mettre `deleted_at` à NULL).
  deletedAt: timestamp("deleted_at"),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// Compteurs de limitation de débit (rate limiting), stockés en base pour
// survivre aux redémarrages et être partagés entre plusieurs instances de
// l'application (voir rateLimit.storage: "database" dans src/lib/auth/index.ts).
// Une rangée par combinaison IP + route ; Better Auth la met à jour ou la
// recrée à chaque requête et purge périodiquement les rangées expirées.
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// Réglages globaux de l'application (ex. nom affiché dans la barre latérale),
// gérés par un administrateur depuis /administration/general. Table à ligne
// unique : `id` a toujours la même valeur (voir APP_SETTINGS_ID dans
// src/lib/settings/app-settings.ts), ce qui garantit qu'il ne peut jamais exister
// qu'une seule rangée.
export const appSettings = pgTable("app_settings", {
  id: text("id").primaryKey(),
  appName: text("app_name").notNull(),
  // Logo personnalisé (facultatif) : octets bruts de l'image + type MIME
  // déclaré à l'upload (voir setLogo/getLogo dans
  // src/lib/settings/app-settings.ts et la validation dans
  // src/lib/settings/logo-validation.ts). Les deux colonnes sont NULL tant
  // qu'aucun logo n'a été téléversé, ou de nouveau après un retrait —
  // l'application retombe alors sur l'icône par défaut (voir
  // src/components/brand-mark.tsx).
  logo: bytea("logo"),
  logoMimeType: text("logo_mime_type"),
  // Couleur principale personnalisée (facultative), en hexadécimal
  // `#RRGGBB` — voir src/lib/settings/color.ts pour sa validation
  // (isValidHexColor) et les calculs qui en dérivent (contraste du texte,
  // variante adaptée au mode sombre). NULL tant qu'aucun administrateur n'en
  // a choisi une : le thème par défaut de globals.css s'applique alors sans
  // aucune modification (voir buildThemeCssVariables, injecté dans
  // src/app/layout.tsx uniquement quand cette colonne est renseignée).
  primaryColor: text("primary_color"),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

// Journal d'audit : trace des actions administratives (création/modification/
// suppression d'utilisateurs et de rôles, changements des paramètres de
// l'application, authentification...), voir src/lib/audit/audit.ts — le SEUL
// module autorisé à écrire dans cette table. WRITE-ONLY par conception :
// aucune fonction de mise à jour ni de suppression n'est exposée par ce
// module, et rien ici n'empêcherait techniquement un UPDATE/DELETE en base,
// mais l'application elle-même ne le fait jamais — une trace d'audit qui
// pourrait être corrigée après coup perdrait sa valeur de preuve.
export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    // Volontairement SANS clé étrangère vers `user.id` : le journal doit
    // survivre à la rangée `user` qui l'a produit (suppression douce
    // aujourd'hui, mais aussi toute évolution future de cette table), et une
    // contrainte de clé étrangère créerait un couplage dans le mauvais sens
    // — une trace passée ne doit jamais pouvoir bloquer ou compliquer une
    // opération sur `user`. `actorLabel` ci-dessous (cliché "Nom (courriel)"
    // pris au moment de l'action) est donc la source de vérité AFFICHÉE,
    // jamais une jointure sur `user` par `actorId` : ce dernier ne sert qu'à
    // filtrer/regrouper (voir listAuditEntries dans src/lib/audit/audit.ts),
    // et peut légitimement pointer vers une rangée `user` désormais
    // supprimée (deleted_at non NULL) ou, en théorie, totalement absente.
    actorId: text("actor_id"),
    // Cliché "Nom (courriel)" de l'auteur au moment de l'action, ou
    // "Système" pour une action déclenchée sans utilisateur connecté (ex.
    // scripts/create-admin.ts). Toujours renseigné (jamais NULL), y compris
    // quand `actorId` devient orphelin par la suite.
    actorLabel: text("actor_label").notNull(),
    // Clé pointée de l'action, ex. "user.create" — voir le catalogue
    // AUDIT_ACTIONS dans src/lib/audit/audit.ts pour la liste complète et
    // leurs libellés français.
    action: text("action").notNull(),
    // Nature de la cible de l'action (ex. "user", "role", "settings"), NULL
    // pour une action sans cible distincte de l'acteur (ex. "auth.login").
    targetType: text("target_type"),
    targetId: text("target_id"),
    // Cliché humain de la cible au moment de l'action (ex. "Marie Tremblay
    // (marie@exemple.com)", "Rôle Comptable"), même raison que `actorLabel`
    // ci-dessus. Chaîne vide (jamais NULL) quand `targetType`/`targetId` sont
    // eux-mêmes absents.
    targetLabel: text("target_label").notNull().default(""),
    // Différence avant/après minimale, propre à chaque action — voir chaque
    // site d'appel de recordAudit (src/lib/audit/audit.ts) pour sa forme
    // exacte, et src/lib/audit/format-details.ts pour son rendu dans
    // l'interface. Clés techniques (anglais) plutôt que françaises : ce sont
    // des données, pas de l'UI. JAMAIS de mot de passe, de hachage ou de
    // jeton, sous quelque forme que ce soit. NULL si l'action n'a pas de
    // détail pertinent au-delà de son enregistrement lui-même.
    details: jsonb("details"),
  },
  (table) => [
    // La liste (/administration/journal) est toujours triée du plus récent
    // au plus ancien (voir listAuditEntries) : cet index sert directement ce
    // tri, en plus de la pagination qui l'accompagne.
    index("audit_log_created_at_idx").on(table.createdAt),
    // Sert le filtre "Acteur" de la même page.
    index("audit_log_actor_id_idx").on(table.actorId),
  ],
);

// ---------------------------------------------------------------------------
// Intranet social : groupes, publications (fil), annonces, événements.
// Identifiants générés via `randomUUID()` (node:crypto) au moment de
// l'insertion, comme pour `audit_log`/`rate_limit` ci-dessus — pas de valeur
// par défaut SQL, la génération se fait en code (voir src/lib/*).
// ---------------------------------------------------------------------------

// Groupes ouverts (v1) : n'importe quel utilisateur connecté peut rejoindre
// ou quitter librement (voir group_member ci-dessous) ; seule la création/
// suppression/renommage du groupe lui-même est protégée par la permission
// `group:manage` (voir src/lib/auth/permissions.ts). Suppression en cascade :
// supprimer un groupe supprime ses membres et ses publications (voir les
// références ci-dessous), aucune suppression douce n'est prévue ici.
export const intranetGroup = pgTable("intranet_group", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Appartenance à un groupe : clé composite (groupId, userId), pas d'`id`
// propre — l'unicité de la relation suffit, aucune ligne ne peut donc être
// dupliquée pour un même couple utilisateur/groupe. `onDelete: "cascade"` des
// deux côtés : supprimer le groupe OU l'utilisateur retire l'appartenance
// sans intervention manuelle.
export const groupMember = pgTable(
  "group_member",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => intranetGroup.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.groupId, table.userId] })],
);

// Publication du fil : message simple, bon coup ("kudos") ou sondage — le
// contenu spécifique aux sondages vit dans poll_option/poll_vote ci-dessous,
// `post` ne porte que ce qui est commun aux trois types. `groupId` NULL
// signifie « fil général » (voir /fil) ; non-NULL signifie « fil du groupe »
// (voir /groupes/[id]), les deux pages réutilisant les mêmes composants.
// `kudosRecipientId` n'a de sens que pour type = "kudos" (validé côté
// serveur, pas de contrainte SQL — cohérent avec l'approche du reste du
// schéma, ex. `announcement`).
export const post = pgTable(
  "post",
  {
    id: text("id").primaryKey(),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    groupId: text("group_id").references(() => intranetGroup.id, {
      onDelete: "cascade",
    }),
    // "message" | "kudos" | "poll" — texte plutôt qu'un enum Postgres pour
    // rester cohérent avec le reste du schéma (ex. `role.id`), validé côté
    // serveur (voir src/lib/*/schemas.ts).
    type: text("type").notNull(),
    body: text("body").notNull(),
    kudosRecipientId: text("kudos_recipient_id").references(() => user.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // Sert le chargement du fil (général ou de groupe), toujours trié du
    // plus récent au plus ancien.
    index("post_group_id_created_at_idx").on(table.groupId, table.createdAt),
  ],
);

// Commentaire d'une publication. Cascade sur `postId` : supprimer un post
// supprime ses commentaires (pas d'affichage de commentaires orphelins).
export const postComment = pgTable(
  "post_comment",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("post_comment_post_id_idx").on(table.postId)],
);

// Réaction à une publication : une seule par (post, utilisateur) — voter à
// nouveau remplace la réaction existante plutôt que d'en ajouter une seconde
// (voir la clé composite ci-dessous, pas d'`id` propre). `emoji` est un texte
// libre en base, mais l'ensemble fermé de valeurs acceptées (👍 ❤️ 🎉 👏 😂)
// est validé côté serveur (voir src/lib/fil/schemas.ts).
export const postReaction = pgTable(
  "post_reaction",
  {
    postId: text("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.postId, table.userId] })],
);

// Option d'un sondage (post de type "poll"), 2 à 5 par sondage (validé côté
// serveur) — `position` fixe l'ordre d'affichage choisi à la création.
export const pollOption = pgTable(
  "poll_option",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [index("poll_option_post_id_idx").on(table.postId)],
);

// Vote à un sondage : un seul vote par utilisateur PAR SONDAGE (pas par
// option), d'où la clé composite (postId, userId) plutôt que (optionId,
// userId) — `optionId` n'est qu'une colonne ordinaire, ce qui rend un
// changement de vote trivial (UPDATE de `optionId`, pas de DELETE/INSERT) et
// interdit structurellement de voter deux fois pour le même sondage.
export const pollVote = pgTable(
  "poll_vote",
  {
    postId: text("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    optionId: text("option_id")
      .notNull()
      .references(() => pollOption.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.postId, table.userId] })],
);

// Annonce (/annonces) : `pinned` fait remonter l'annonce en tête de liste et
// affiche le petit rappel en haut du fil général (voir /fil). Création/
// épinglage/suppression protégés par `announcement:manage` (voir
// src/lib/auth/permissions.ts) ; lecture ouverte à tout utilisateur connecté.
export const announcement = pgTable("announcement", {
  id: text("id").primaryKey(),
  authorId: text("author_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  pinned: boolean("pinned").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Marquage « lu » d'une annonce par utilisateur, explicite (bouton, pas
// automatique à l'affichage — voir le plan produit) : clé composite, une
// seule ligne par couple (annonce, utilisateur). Sert aussi le compteur
// « Lue par X/Y » affiché aux détenteurs de `announcement:manage`.
export const announcementRead = pgTable(
  "announcement_read",
  {
    announcementId: text("announcement_id")
      .notNull()
      .references(() => announcement.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.announcementId, table.userId] })],
);

// Événement du calendrier (/calendrier, affiché en liste — voir le plan
// produit). `endsAt` et `location`/`description` sont facultatifs ; `allDay`
// indique un événement sans heure précise (affichage adapté côté UI).
// Création/modification/suppression protégées par `event:manage`.
export const event = pgTable(
  "event",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    location: text("location"),
    startsAt: timestamp("starts_at").notNull(),
    endsAt: timestamp("ends_at"),
    allDay: boolean("all_day").default(false).notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("event_starts_at_idx").on(table.startsAt)],
);

export const intranetGroupRelations = relations(intranetGroup, ({ many }) => ({
  members: many(groupMember),
  posts: many(post),
}));

export const groupMemberRelations = relations(groupMember, ({ one }) => ({
  group: one(intranetGroup, {
    fields: [groupMember.groupId],
    references: [intranetGroup.id],
  }),
  user: one(user, {
    fields: [groupMember.userId],
    references: [user.id],
  }),
}));

export const postRelations = relations(post, ({ one, many }) => ({
  author: one(user, {
    fields: [post.authorId],
    references: [user.id],
  }),
  group: one(intranetGroup, {
    fields: [post.groupId],
    references: [intranetGroup.id],
  }),
  kudosRecipient: one(user, {
    fields: [post.kudosRecipientId],
    references: [user.id],
  }),
  comments: many(postComment),
  reactions: many(postReaction),
  pollOptions: many(pollOption),
}));

export const postCommentRelations = relations(postComment, ({ one }) => ({
  post: one(post, {
    fields: [postComment.postId],
    references: [post.id],
  }),
  author: one(user, {
    fields: [postComment.authorId],
    references: [user.id],
  }),
}));

export const postReactionRelations = relations(postReaction, ({ one }) => ({
  post: one(post, {
    fields: [postReaction.postId],
    references: [post.id],
  }),
  user: one(user, {
    fields: [postReaction.userId],
    references: [user.id],
  }),
}));

export const pollOptionRelations = relations(pollOption, ({ one, many }) => ({
  post: one(post, {
    fields: [pollOption.postId],
    references: [post.id],
  }),
  votes: many(pollVote),
}));

export const pollVoteRelations = relations(pollVote, ({ one }) => ({
  post: one(post, {
    fields: [pollVote.postId],
    references: [post.id],
  }),
  user: one(user, {
    fields: [pollVote.userId],
    references: [user.id],
  }),
  option: one(pollOption, {
    fields: [pollVote.optionId],
    references: [pollOption.id],
  }),
}));

export const announcementRelations = relations(announcement, ({ one, many }) => ({
  author: one(user, {
    fields: [announcement.authorId],
    references: [user.id],
  }),
  reads: many(announcementRead),
}));

export const announcementReadRelations = relations(announcementRead, ({ one }) => ({
  announcement: one(announcement, {
    fields: [announcementRead.announcementId],
    references: [announcement.id],
  }),
  user: one(user, {
    fields: [announcementRead.userId],
    references: [user.id],
  }),
}));

export const eventRelations = relations(event, ({ one }) => ({
  createdByUser: one(user, {
    fields: [event.createdBy],
    references: [user.id],
  }),
}));

export const userRelations = relations(user, ({ one, many }) => ({
  sessions: many(session),
  accounts: many(account),
  roleRef: one(role, {
    fields: [user.role],
    references: [role.id],
  }),
}));

export const roleRelations = relations(role, ({ many }) => ({
  users: many(user),
  permissions: many(rolePermission),
}));

export const rolePermissionRelations = relations(rolePermission, ({ one }) => ({
  role: one(role, {
    fields: [rolePermission.roleId],
    references: [role.id],
  }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));
