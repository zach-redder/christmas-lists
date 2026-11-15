CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"claimer_id" uuid NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"snapshot" jsonb NOT NULL,
	"dismissed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"added_by_id" uuid NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"notes" text,
	"price" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "items_price_check" CHECK ("items"."price" IS NULL OR "items"."price" IN ('$', '$$', '$$$'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_claims_item_id_unique" ON "claims" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_claims_claimer_id" ON "claims" USING btree ("claimer_id");--> statement-breakpoint
CREATE INDEX "idx_items_owner_active" ON "items" USING btree ("owner_id") WHERE "items"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_name_key_unique" ON "users" USING btree ("name_key");