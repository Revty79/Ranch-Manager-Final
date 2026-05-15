CREATE TYPE "public"."equipment_status" AS ENUM('active', 'needs_maintenance', 'down', 'retired');--> statement-breakpoint
CREATE TYPE "public"."equipment_type" AS ENUM('truck', 'tractor', 'trailer', 'atv', 'utv', 'implement', 'pump', 'tool', 'other');--> statement-breakpoint
CREATE TYPE "public"."maintenance_priority" AS ENUM('low', 'normal', 'high');--> statement-breakpoint
CREATE TYPE "public"."maintenance_status" AS ENUM('scheduled', 'due', 'overdue', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."maintenance_type" AS ENUM('routine', 'repair', 'inspection', 'oil_change', 'tire', 'fluids', 'service', 'other');--> statement-breakpoint
CREATE TABLE "equipment_maintenance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ranch_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"title" text NOT NULL,
	"maintenance_type" "maintenance_type" DEFAULT 'routine' NOT NULL,
	"status" "maintenance_status" DEFAULT 'scheduled' NOT NULL,
	"priority" "maintenance_priority" DEFAULT 'normal' NOT NULL,
	"due_on" date,
	"completed_on" date,
	"assigned_membership_id" uuid,
	"related_work_order_id" uuid,
	"cost_cents" integer,
	"notes" text,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ranch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"equipment_type" "equipment_type" DEFAULT 'other' NOT NULL,
	"status" "equipment_status" DEFAULT 'active' NOT NULL,
	"identifier" text,
	"make" text,
	"model" text,
	"year" integer,
	"serial_number" text,
	"plate_vin" text,
	"current_location" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "equipment_maintenance_records" ADD CONSTRAINT "equipment_maintenance_records_ranch_id_ranches_id_fk" FOREIGN KEY ("ranch_id") REFERENCES "public"."ranches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_maintenance_records" ADD CONSTRAINT "equipment_maintenance_records_equipment_id_equipment_records_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_maintenance_records" ADD CONSTRAINT "equipment_maintenance_records_assigned_membership_id_ranch_memberships_id_fk" FOREIGN KEY ("assigned_membership_id") REFERENCES "public"."ranch_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_maintenance_records" ADD CONSTRAINT "equipment_maintenance_records_related_work_order_id_work_orders_id_fk" FOREIGN KEY ("related_work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_maintenance_records" ADD CONSTRAINT "equipment_maintenance_records_created_by_membership_id_ranch_memberships_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."ranch_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_records" ADD CONSTRAINT "equipment_records_ranch_id_ranches_id_fk" FOREIGN KEY ("ranch_id") REFERENCES "public"."ranches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "equipment_maintenance_records_ranch_idx" ON "equipment_maintenance_records" USING btree ("ranch_id");--> statement-breakpoint
CREATE INDEX "equipment_maintenance_records_equipment_idx" ON "equipment_maintenance_records" USING btree ("equipment_id");--> statement-breakpoint
CREATE INDEX "equipment_maintenance_records_status_idx" ON "equipment_maintenance_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "equipment_maintenance_records_due_on_idx" ON "equipment_maintenance_records" USING btree ("due_on");--> statement-breakpoint
CREATE INDEX "equipment_maintenance_records_related_work_order_idx" ON "equipment_maintenance_records" USING btree ("related_work_order_id");--> statement-breakpoint
CREATE INDEX "equipment_maintenance_records_assigned_idx" ON "equipment_maintenance_records" USING btree ("assigned_membership_id");--> statement-breakpoint
CREATE INDEX "equipment_maintenance_records_updated_idx" ON "equipment_maintenance_records" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "equipment_records_ranch_idx" ON "equipment_records" USING btree ("ranch_id");--> statement-breakpoint
CREATE INDEX "equipment_records_status_idx" ON "equipment_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "equipment_records_type_idx" ON "equipment_records" USING btree ("equipment_type");--> statement-breakpoint
CREATE INDEX "equipment_records_identifier_idx" ON "equipment_records" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "equipment_records_updated_idx" ON "equipment_records" USING btree ("updated_at");