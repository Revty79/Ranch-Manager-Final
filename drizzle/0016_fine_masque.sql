ALTER TYPE "public"."animal_event_type" ADD VALUE 'cull' BEFORE 'note';--> statement-breakpoint
ALTER TYPE "public"."animal_status" ADD VALUE 'culled' BEFORE 'transferred';--> statement-breakpoint
ALTER TABLE "animals" ADD COLUMN "color_markings" text;--> statement-breakpoint
ALTER TABLE "animals" ADD COLUMN "is_birth_date_estimated" boolean DEFAULT false NOT NULL;