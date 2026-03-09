CREATE TYPE "public"."work_order_incentive_timer_type" AS ENUM('none', 'hours', 'deadline');--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "incentive_pay_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "incentive_timer_type" "work_order_incentive_timer_type" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "incentive_duration_hours" integer;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "incentive_ends_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "work_orders_incentive_ends_idx" ON "work_orders" USING btree ("incentive_ends_at");