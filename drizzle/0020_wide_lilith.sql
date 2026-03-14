CREATE TYPE "public"."ranch_message_priority" AS ENUM('normal', 'urgent');--> statement-breakpoint
CREATE TABLE "ranch_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ranch_id" uuid NOT NULL,
	"author_membership_id" uuid,
	"parent_message_id" uuid,
	"title" text,
	"body" text NOT NULL,
	"priority" "ranch_message_priority" DEFAULT 'normal' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ranch_messages" ADD CONSTRAINT "ranch_messages_ranch_id_ranches_id_fk" FOREIGN KEY ("ranch_id") REFERENCES "public"."ranches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranch_messages" ADD CONSTRAINT "ranch_messages_author_membership_id_ranch_memberships_id_fk" FOREIGN KEY ("author_membership_id") REFERENCES "public"."ranch_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranch_messages" ADD CONSTRAINT "ranch_messages_parent_message_id_ranch_messages_id_fk" FOREIGN KEY ("parent_message_id") REFERENCES "public"."ranch_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ranch_messages_ranch_idx" ON "ranch_messages" USING btree ("ranch_id");--> statement-breakpoint
CREATE INDEX "ranch_messages_parent_idx" ON "ranch_messages" USING btree ("parent_message_id");--> statement-breakpoint
CREATE INDEX "ranch_messages_priority_idx" ON "ranch_messages" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "ranch_messages_created_idx" ON "ranch_messages" USING btree ("created_at");