CREATE TYPE "public"."herd_protocol_type" AS ENUM('vaccination', 'deworming', 'pregnancy_check', 'pre_breeding', 'pre_birth_planning');--> statement-breakpoint
CREATE TABLE "herd_protocol_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ranch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"protocol_type" "herd_protocol_type" NOT NULL,
	"species" "animal_species",
	"sex" "animal_sex",
	"interval_days" integer NOT NULL,
	"due_soon_days" integer DEFAULT 14 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "herd_protocol_templates" ADD CONSTRAINT "herd_protocol_templates_ranch_id_ranches_id_fk" FOREIGN KEY ("ranch_id") REFERENCES "public"."ranches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "herd_protocol_templates_ranch_idx" ON "herd_protocol_templates" USING btree ("ranch_id");--> statement-breakpoint
CREATE INDEX "herd_protocol_templates_active_idx" ON "herd_protocol_templates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "herd_protocol_templates_type_idx" ON "herd_protocol_templates" USING btree ("protocol_type");