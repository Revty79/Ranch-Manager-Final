CREATE TYPE "public"."work_order_compensation_type" AS ENUM('standard', 'flat_amount');--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "compensation_type" "work_order_compensation_type" DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "flat_pay_cents" integer DEFAULT 0 NOT NULL;