DROP INDEX "idx_users_name_key_unique";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "family" text DEFAULT 'redder' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_family_name_key_unique" ON "users" USING btree ("family","name_key");