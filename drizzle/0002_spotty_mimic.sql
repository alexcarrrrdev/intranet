CREATE TABLE "app_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"app_name" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
