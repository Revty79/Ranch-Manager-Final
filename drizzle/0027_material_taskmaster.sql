CREATE TYPE "public"."work_order_recurrence_cadence" AS ENUM('daily', 'weekly', 'monthly', 'custom');--> statement-breakpoint
CREATE TABLE "work_order_template_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ranch_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_order_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ranch_id" uuid NOT NULL,
	"template_name" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"priority" "work_order_priority" DEFAULT 'normal' NOT NULL,
	"compensation_type" "work_order_compensation_type" DEFAULT 'standard' NOT NULL,
	"flat_pay_cents" integer DEFAULT 0 NOT NULL,
	"incentive_pay_cents" integer DEFAULT 0 NOT NULL,
	"incentive_timer_type" "work_order_incentive_timer_type" DEFAULT 'none' NOT NULL,
	"incentive_duration_hours" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"recurring_enabled" boolean DEFAULT false NOT NULL,
	"recurrence_cadence" "work_order_recurrence_cadence",
	"recurrence_interval_days" integer,
	"next_generation_on" date,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "template_id" uuid;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "generated_for_date" date;--> statement-breakpoint
ALTER TABLE "work_order_template_assignments" ADD CONSTRAINT "work_order_template_assignments_ranch_id_ranches_id_fk" FOREIGN KEY ("ranch_id") REFERENCES "public"."ranches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_template_assignments" ADD CONSTRAINT "work_order_template_assignments_template_id_work_order_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."work_order_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_template_assignments" ADD CONSTRAINT "work_order_template_assignments_membership_id_ranch_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."ranch_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_templates" ADD CONSTRAINT "work_order_templates_ranch_id_ranches_id_fk" FOREIGN KEY ("ranch_id") REFERENCES "public"."ranches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_templates" ADD CONSTRAINT "work_order_templates_created_by_membership_id_ranch_memberships_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."ranch_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_order_template_assignments_ranch_idx" ON "work_order_template_assignments" USING btree ("ranch_id");--> statement-breakpoint
CREATE INDEX "work_order_template_assignments_template_idx" ON "work_order_template_assignments" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "work_order_template_assignments_membership_idx" ON "work_order_template_assignments" USING btree ("membership_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_order_template_assignments_unique" ON "work_order_template_assignments" USING btree ("template_id","membership_id");--> statement-breakpoint
CREATE INDEX "work_order_templates_ranch_idx" ON "work_order_templates" USING btree ("ranch_id");--> statement-breakpoint
CREATE INDEX "work_order_templates_active_idx" ON "work_order_templates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "work_order_templates_next_gen_idx" ON "work_order_templates" USING btree ("next_generation_on");--> statement-breakpoint
CREATE UNIQUE INDEX "work_order_templates_ranch_name_uidx" ON "work_order_templates" USING btree ("ranch_id","template_name");--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_template_id_work_order_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."work_order_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_orders_template_idx" ON "work_orders" USING btree ("template_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_orders_template_generated_uidx" ON "work_orders" USING btree ("template_id","generated_for_date") WHERE "work_orders"."template_id" is not null and "work_orders"."generated_for_date" is not null;