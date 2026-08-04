CREATE TABLE "role" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permission" (
	"role_id" text NOT NULL,
	"permission" text NOT NULL,
	CONSTRAINT "role_permission_role_id_permission_pk" PRIMARY KEY("role_id","permission")
);
--> statement-breakpoint
-- Rôles « système » initiaux, insérés ICI (après la création des tables,
-- avant les contraintes de clé étrangère ci-dessous) : les utilisateurs
-- existants ont déjà "admin" ou "member" comme valeur de colonne
-- "user"."role", qui doit exister dans "role" au moment où la contrainte
-- de clé étrangère est ajoutée sur "user", sans quoi elle échouerait sur
-- toute base contenant déjà des utilisateurs.
--
-- "admin" n'a aucune rangée role_permission : il a accès à tout via un
-- court-circuit dans le code (voir getPermissionsForRole dans
-- src/lib/auth/permissions.ts), y compris aux ressources ajoutées plus tard.
-- "member" reprend les permissions qu'il avait déjà statiquement avant
-- l'introduction de cette table (user:read, settings:read).
INSERT INTO "role" ("id", "name", "description", "is_system") VALUES
	('admin', 'Administrateur', 'Accès complet à toutes les fonctionnalités de l''application.', true),
	('member', 'Membre', 'Accès de base : lecture des utilisateurs et des paramètres.', true);
--> statement-breakpoint
INSERT INTO "role_permission" ("role_id", "permission") VALUES
	('member', 'user:read'),
	('member', 'settings:read');
--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_role_role_id_fk" FOREIGN KEY ("role") REFERENCES "public"."role"("id") ON DELETE restrict ON UPDATE no action;