CREATE TYPE "public"."grazing_period_status" AS ENUM('planned', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "grazing_period_animals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ranch_id" uuid NOT NULL,
	"grazing_period_id" uuid NOT NULL,
	"animal_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grazing_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ranch_id" uuid NOT NULL,
	"land_unit_id" uuid NOT NULL,
	"animal_group_id" uuid,
	"status" "grazing_period_status" DEFAULT 'active' NOT NULL,
	"started_on" date NOT NULL,
	"ended_on" date,
	"planned_move_on" date,
	"notes" text,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "land_units" ADD COLUMN "estimated_forage_lbs_per_acre" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "land_units" ADD COLUMN "target_utilization_percent" integer;--> statement-breakpoint
ALTER TABLE "land_units" ADD COLUMN "target_rest_days" integer;--> statement-breakpoint
ALTER TABLE "land_units" ADD COLUMN "seasonal_notes" text;--> statement-breakpoint
ALTER TABLE "grazing_period_animals" ADD CONSTRAINT "grazing_period_animals_ranch_id_ranches_id_fk" FOREIGN KEY ("ranch_id") REFERENCES "public"."ranches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grazing_period_animals" ADD CONSTRAINT "grazing_period_animals_grazing_period_id_grazing_periods_id_fk" FOREIGN KEY ("grazing_period_id") REFERENCES "public"."grazing_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grazing_period_animals" ADD CONSTRAINT "grazing_period_animals_animal_id_animals_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grazing_periods" ADD CONSTRAINT "grazing_periods_ranch_id_ranches_id_fk" FOREIGN KEY ("ranch_id") REFERENCES "public"."ranches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grazing_periods" ADD CONSTRAINT "grazing_periods_land_unit_id_land_units_id_fk" FOREIGN KEY ("land_unit_id") REFERENCES "public"."land_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grazing_periods" ADD CONSTRAINT "grazing_periods_animal_group_id_animal_groups_id_fk" FOREIGN KEY ("animal_group_id") REFERENCES "public"."animal_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grazing_periods" ADD CONSTRAINT "grazing_periods_created_by_membership_id_ranch_memberships_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."ranch_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "grazing_period_animals_ranch_idx" ON "grazing_period_animals" USING btree ("ranch_id");--> statement-breakpoint
CREATE INDEX "grazing_period_animals_period_idx" ON "grazing_period_animals" USING btree ("grazing_period_id");--> statement-breakpoint
CREATE INDEX "grazing_period_animals_animal_idx" ON "grazing_period_animals" USING btree ("animal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "grazing_period_animals_period_animal_uidx" ON "grazing_period_animals" USING btree ("grazing_period_id","animal_id");--> statement-breakpoint
CREATE INDEX "grazing_periods_ranch_idx" ON "grazing_periods" USING btree ("ranch_id");--> statement-breakpoint
CREATE INDEX "grazing_periods_land_unit_idx" ON "grazing_periods" USING btree ("land_unit_id");--> statement-breakpoint
CREATE INDEX "grazing_periods_status_idx" ON "grazing_periods" USING btree ("status");--> statement-breakpoint
CREATE INDEX "grazing_periods_started_on_idx" ON "grazing_periods" USING btree ("started_on");