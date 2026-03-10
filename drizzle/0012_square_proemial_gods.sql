CREATE TYPE "public"."payroll_period_status" AS ENUM('open', 'paid');--> statement-breakpoint
CREATE TABLE "payroll_period_advances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ranch_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"note" text,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_period_member_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ranch_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"is_check_picked_up" boolean DEFAULT false NOT NULL,
	"picked_up_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ranch_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"pay_date" date NOT NULL,
	"status" "payroll_period_status" DEFAULT 'open' NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_settings" (
	"ranch_id" uuid PRIMARY KEY NOT NULL,
	"anchor_start_date" date NOT NULL,
	"period_length_days" integer DEFAULT 14 NOT NULL,
	"payday_offset_days" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payroll_period_advances" ADD CONSTRAINT "payroll_period_advances_ranch_id_ranches_id_fk" FOREIGN KEY ("ranch_id") REFERENCES "public"."ranches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_period_advances" ADD CONSTRAINT "payroll_period_advances_period_id_payroll_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."payroll_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_period_advances" ADD CONSTRAINT "payroll_period_advances_membership_id_ranch_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."ranch_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_period_advances" ADD CONSTRAINT "payroll_period_advances_created_by_membership_id_ranch_memberships_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."ranch_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_period_member_receipts" ADD CONSTRAINT "payroll_period_member_receipts_ranch_id_ranches_id_fk" FOREIGN KEY ("ranch_id") REFERENCES "public"."ranches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_period_member_receipts" ADD CONSTRAINT "payroll_period_member_receipts_period_id_payroll_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."payroll_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_period_member_receipts" ADD CONSTRAINT "payroll_period_member_receipts_membership_id_ranch_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."ranch_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_ranch_id_ranches_id_fk" FOREIGN KEY ("ranch_id") REFERENCES "public"."ranches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_ranch_id_ranches_id_fk" FOREIGN KEY ("ranch_id") REFERENCES "public"."ranches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payroll_period_advances_ranch_idx" ON "payroll_period_advances" USING btree ("ranch_id");--> statement-breakpoint
CREATE INDEX "payroll_period_advances_period_idx" ON "payroll_period_advances" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "payroll_period_advances_member_idx" ON "payroll_period_advances" USING btree ("membership_id");--> statement-breakpoint
CREATE INDEX "payroll_period_receipts_ranch_idx" ON "payroll_period_member_receipts" USING btree ("ranch_id");--> statement-breakpoint
CREATE INDEX "payroll_period_receipts_period_idx" ON "payroll_period_member_receipts" USING btree ("period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_period_receipts_period_member_uidx" ON "payroll_period_member_receipts" USING btree ("period_id","membership_id");--> statement-breakpoint
CREATE INDEX "payroll_periods_ranch_idx" ON "payroll_periods" USING btree ("ranch_id");--> statement-breakpoint
CREATE INDEX "payroll_periods_start_idx" ON "payroll_periods" USING btree ("period_start");--> statement-breakpoint
CREATE INDEX "payroll_periods_pay_date_idx" ON "payroll_periods" USING btree ("pay_date");--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_periods_ranch_start_uidx" ON "payroll_periods" USING btree ("ranch_id","period_start");--> statement-breakpoint
CREATE INDEX "payroll_settings_anchor_idx" ON "payroll_settings" USING btree ("anchor_start_date");