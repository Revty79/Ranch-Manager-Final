CREATE TYPE "public"."work_order_priority" AS ENUM('low', 'normal', 'high');--> statement-breakpoint
CREATE TYPE "public"."work_order_status" AS ENUM('draft', 'open', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "work_order_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ranch_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "work_order_status" DEFAULT 'draft' NOT NULL,
	"priority" "work_order_priority" DEFAULT 'normal' NOT NULL,
	"due_at" timestamp with time zone,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "work_order_assignments" ADD CONSTRAINT "work_order_assignments_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_assignments" ADD CONSTRAINT "work_order_assignments_membership_id_ranch_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."ranch_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_ranch_id_ranches_id_fk" FOREIGN KEY ("ranch_id") REFERENCES "public"."ranches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_created_by_membership_id_ranch_memberships_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."ranch_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_order_assignments_work_order_idx" ON "work_order_assignments" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "work_order_assignments_membership_idx" ON "work_order_assignments" USING btree ("membership_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_order_assignment_unique" ON "work_order_assignments" USING btree ("work_order_id","membership_id");--> statement-breakpoint
CREATE INDEX "work_orders_ranch_idx" ON "work_orders" USING btree ("ranch_id");--> statement-breakpoint
CREATE INDEX "work_orders_status_idx" ON "work_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "work_orders_due_idx" ON "work_orders" USING btree ("due_at");