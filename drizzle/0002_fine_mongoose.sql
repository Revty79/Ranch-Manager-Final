CREATE TYPE "public"."pay_type" AS ENUM('hourly', 'salary');--> statement-breakpoint
ALTER TABLE "ranch_memberships" ADD COLUMN "pay_type" "pay_type" DEFAULT 'hourly' NOT NULL;--> statement-breakpoint
ALTER TABLE "ranch_memberships" ADD COLUMN "pay_rate_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ranch_memberships" ADD COLUMN "deactivated_at" timestamp with time zone;