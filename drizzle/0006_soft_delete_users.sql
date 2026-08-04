ALTER TABLE "user" ADD COLUMN "deleted_at" timestamp;
--> statement-breakpoint
-- Changement de donnée délibéré (pas seulement un changement de schéma) :
-- retire les DEUX permissions par défaut que la migration 0005 avait
-- accordées au rôle "member" ("user:read" et "settings:read"), et
-- SEULEMENT celles-là — toute autre permission accordée à "member" depuis
-- (via /administration/roles, par un administrateur) est volontairement
-- laissée intacte, ce n'est pas à cette migration de la toucher.
--
-- Nouveau comportement par défaut du template : un rôle "member" fraîchement
-- créé (ou une base de données qui vient d'appliquer 0005 puis 0006) démarre
-- avec AUCUNE permission plutôt qu'avec un accès de lecture implicite — un
-- administrateur doit désormais accorder explicitement chaque permission.
-- Les bases existantes où "member" a déjà été personnalisé ne perdent que
-- ces deux rangées précises.
DELETE FROM "role_permission" WHERE "role_id" = 'member' AND "permission" IN ('user:read', 'settings:read');