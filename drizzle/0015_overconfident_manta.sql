CREATE TYPE "public"."animal_event_type" AS ENUM('birth', 'acquisition', 'breeding', 'pregnancy_check', 'vaccination', 'treatment', 'deworming', 'movement', 'death', 'sale_disposition', 'note');--> statement-breakpoint
CREATE TYPE "public"."animal_group_type" AS ENUM('management', 'breeding', 'health', 'marketing', 'custom');--> statement-breakpoint
CREATE TYPE "public"."animal_sex" AS ENUM('female', 'male', 'castrated_male', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."animal_species" AS ENUM('cattle', 'horse', 'other');--> statement-breakpoint
CREATE TYPE "public"."animal_status" AS ENUM('active', 'sold', 'deceased', 'transferred', 'archived');--> statement-breakpoint
CREATE TYPE "public"."land_unit_type" AS ENUM('pasture', 'field', 'trap', 'lot', 'corral', 'pen', 'stall', 'barn_area', 'holding_area', 'other');--> statement-breakpoint
CREATE TYPE "public"."movement_reason" AS ENUM('grazing_rotation', 'feeding', 'breeding', 'health_hold', 'weaning', 'training', 'weather', 'other');--> statement-breakpoint
CREATE TABLE "animal_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ranch_id" uuid NOT NULL,
	"animal_id" uuid NOT NULL,
	"animal_group_id" uuid,
	"event_type" "animal_event_type" DEFAULT 'note' NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"summary" text NOT NULL,
	"details" text,
	"event_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"recorded_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "animal_group_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ranch_id" uuid NOT NULL,
	"animal_group_id" uuid NOT NULL,
	"animal_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"membership_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "animal_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ranch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"group_type" "animal_group_type" DEFAULT 'management' NOT NULL,
	"description" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "animal_location_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ranch_id" uuid NOT NULL,
	"animal_id" uuid NOT NULL,
	"land_unit_id" uuid NOT NULL,
	"movement_reason" "movement_reason" DEFAULT 'other' NOT NULL,
	"movement_batch_key" text,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"assigned_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "animals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ranch_id" uuid NOT NULL,
	"internal_id" text NOT NULL,
	"tag_id" text NOT NULL,
	"alternate_id" text,
	"display_name" text,
	"species" "animal_species" DEFAULT 'cattle' NOT NULL,
	"sex" "animal_sex" DEFAULT 'unknown' NOT NULL,
	"animal_class" text,
	"breed" text,
	"status" "animal_status" DEFAULT 'active' NOT NULL,
	"birth_date" date,
	"sire_animal_id" uuid,
	"dam_animal_id" uuid,
	"acquired_on" date,
	"acquisition_method" text,
	"acquisition_source" text,
	"disposition_on" date,
	"disposition_reason" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "herd_land_settings" (
	"ranch_id" uuid PRIMARY KEY NOT NULL,
	"species_defaults" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reproductive_defaults" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"grazing_defaults" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"calculation_defaults" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "land_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ranch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"unit_type" "land_unit_type" DEFAULT 'pasture' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"acreage" numeric(10, 2),
	"grazeable_acreage" numeric(10, 2),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"water_summary" text,
	"fencing_summary" text,
	"current_use" text,
	"current_status" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "animal_events" ADD CONSTRAINT "animal_events_ranch_id_ranches_id_fk" FOREIGN KEY ("ranch_id") REFERENCES "public"."ranches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animal_events" ADD CONSTRAINT "animal_events_animal_id_animals_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animal_events" ADD CONSTRAINT "animal_events_animal_group_id_animal_groups_id_fk" FOREIGN KEY ("animal_group_id") REFERENCES "public"."animal_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animal_events" ADD CONSTRAINT "animal_events_recorded_by_membership_id_ranch_memberships_id_fk" FOREIGN KEY ("recorded_by_membership_id") REFERENCES "public"."ranch_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animal_group_memberships" ADD CONSTRAINT "animal_group_memberships_ranch_id_ranches_id_fk" FOREIGN KEY ("ranch_id") REFERENCES "public"."ranches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animal_group_memberships" ADD CONSTRAINT "animal_group_memberships_animal_group_id_animal_groups_id_fk" FOREIGN KEY ("animal_group_id") REFERENCES "public"."animal_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animal_group_memberships" ADD CONSTRAINT "animal_group_memberships_animal_id_animals_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animal_groups" ADD CONSTRAINT "animal_groups_ranch_id_ranches_id_fk" FOREIGN KEY ("ranch_id") REFERENCES "public"."ranches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animal_location_assignments" ADD CONSTRAINT "animal_location_assignments_ranch_id_ranches_id_fk" FOREIGN KEY ("ranch_id") REFERENCES "public"."ranches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animal_location_assignments" ADD CONSTRAINT "animal_location_assignments_animal_id_animals_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animal_location_assignments" ADD CONSTRAINT "animal_location_assignments_land_unit_id_land_units_id_fk" FOREIGN KEY ("land_unit_id") REFERENCES "public"."land_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animal_location_assignments" ADD CONSTRAINT "animal_location_assignments_assigned_by_membership_id_ranch_memberships_id_fk" FOREIGN KEY ("assigned_by_membership_id") REFERENCES "public"."ranch_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_ranch_id_ranches_id_fk" FOREIGN KEY ("ranch_id") REFERENCES "public"."ranches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_sire_animal_id_animals_id_fk" FOREIGN KEY ("sire_animal_id") REFERENCES "public"."animals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_dam_animal_id_animals_id_fk" FOREIGN KEY ("dam_animal_id") REFERENCES "public"."animals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herd_land_settings" ADD CONSTRAINT "herd_land_settings_ranch_id_ranches_id_fk" FOREIGN KEY ("ranch_id") REFERENCES "public"."ranches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "land_units" ADD CONSTRAINT "land_units_ranch_id_ranches_id_fk" FOREIGN KEY ("ranch_id") REFERENCES "public"."ranches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "animal_events_ranch_idx" ON "animal_events" USING btree ("ranch_id");--> statement-breakpoint
CREATE INDEX "animal_events_animal_idx" ON "animal_events" USING btree ("animal_id");--> statement-breakpoint
CREATE INDEX "animal_events_group_idx" ON "animal_events" USING btree ("animal_group_id");--> statement-breakpoint
CREATE INDEX "animal_events_type_idx" ON "animal_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "animal_events_occurred_idx" ON "animal_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "animal_group_memberships_ranch_idx" ON "animal_group_memberships" USING btree ("ranch_id");--> statement-breakpoint
CREATE INDEX "animal_group_memberships_group_idx" ON "animal_group_memberships" USING btree ("animal_group_id");--> statement-breakpoint
CREATE INDEX "animal_group_memberships_animal_idx" ON "animal_group_memberships" USING btree ("animal_id");--> statement-breakpoint
CREATE INDEX "animal_group_memberships_active_idx" ON "animal_group_memberships" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "animal_group_memberships_active_uidx" ON "animal_group_memberships" USING btree ("animal_group_id","animal_id") WHERE "animal_group_memberships"."is_active" = true;--> statement-breakpoint
CREATE INDEX "animal_groups_ranch_idx" ON "animal_groups" USING btree ("ranch_id");--> statement-breakpoint
CREATE INDEX "animal_groups_active_idx" ON "animal_groups" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "animal_groups_ranch_name_uidx" ON "animal_groups" USING btree ("ranch_id","name");--> statement-breakpoint
CREATE INDEX "animal_location_assignments_ranch_idx" ON "animal_location_assignments" USING btree ("ranch_id");--> statement-breakpoint
CREATE INDEX "animal_location_assignments_animal_idx" ON "animal_location_assignments" USING btree ("animal_id");--> statement-breakpoint
CREATE INDEX "animal_location_assignments_land_idx" ON "animal_location_assignments" USING btree ("land_unit_id");--> statement-breakpoint
CREATE INDEX "animal_location_assignments_active_idx" ON "animal_location_assignments" USING btree ("ranch_id","is_active");--> statement-breakpoint
CREATE INDEX "animal_location_assignments_occupancy_idx" ON "animal_location_assignments" USING btree ("ranch_id","land_unit_id","is_active");--> statement-breakpoint
CREATE INDEX "animal_location_assignments_assigned_idx" ON "animal_location_assignments" USING btree ("assigned_at");--> statement-breakpoint
CREATE UNIQUE INDEX "animal_location_assignments_active_uidx" ON "animal_location_assignments" USING btree ("animal_id") WHERE "animal_location_assignments"."is_active" = true;--> statement-breakpoint
CREATE INDEX "animals_ranch_idx" ON "animals" USING btree ("ranch_id");--> statement-breakpoint
CREATE INDEX "animals_status_idx" ON "animals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "animals_species_idx" ON "animals" USING btree ("species");--> statement-breakpoint
CREATE INDEX "animals_birth_idx" ON "animals" USING btree ("birth_date");--> statement-breakpoint
CREATE INDEX "animals_sire_idx" ON "animals" USING btree ("sire_animal_id");--> statement-breakpoint
CREATE INDEX "animals_dam_idx" ON "animals" USING btree ("dam_animal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "animals_ranch_internal_id_uidx" ON "animals" USING btree ("ranch_id","internal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "animals_ranch_tag_uidx" ON "animals" USING btree ("ranch_id","tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "animals_ranch_alt_id_uidx" ON "animals" USING btree ("ranch_id","alternate_id") WHERE "animals"."alternate_id" is not null;--> statement-breakpoint
CREATE INDEX "land_units_ranch_idx" ON "land_units" USING btree ("ranch_id");--> statement-breakpoint
CREATE INDEX "land_units_type_idx" ON "land_units" USING btree ("unit_type");--> statement-breakpoint
CREATE INDEX "land_units_active_idx" ON "land_units" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "land_units_sort_idx" ON "land_units" USING btree ("sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "land_units_ranch_code_uidx" ON "land_units" USING btree ("ranch_id","code") WHERE "land_units"."code" is not null;