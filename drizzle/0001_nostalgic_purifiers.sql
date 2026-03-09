CREATE TYPE "public"."onboarding_state" AS ENUM('needs_ranch', 'complete');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('inactive', 'trialing', 'active', 'past_due', 'canceled');--> statement-breakpoint
ALTER TABLE "ranches" ALTER COLUMN "subscription_status" SET DEFAULT 'inactive'::"public"."subscription_status";--> statement-breakpoint
ALTER TABLE "ranches" ALTER COLUMN "subscription_status" SET DATA TYPE "public"."subscription_status" USING "subscription_status"::"public"."subscription_status";--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "token_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_state" "onboarding_state" DEFAULT 'needs_ranch' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_active_ranch_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "ranch_memberships_ranch_user_uidx" ON "ranch_memberships" USING btree ("ranch_id","user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash");