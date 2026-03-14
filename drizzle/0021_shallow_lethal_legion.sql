CREATE TABLE "ranch_direct_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ranch_id" uuid NOT NULL,
	"sender_membership_id" uuid,
	"recipient_membership_id" uuid,
	"body" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ranch_direct_messages" ADD CONSTRAINT "ranch_direct_messages_ranch_id_ranches_id_fk" FOREIGN KEY ("ranch_id") REFERENCES "public"."ranches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranch_direct_messages" ADD CONSTRAINT "ranch_direct_messages_sender_membership_id_ranch_memberships_id_fk" FOREIGN KEY ("sender_membership_id") REFERENCES "public"."ranch_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranch_direct_messages" ADD CONSTRAINT "ranch_direct_messages_recipient_membership_id_ranch_memberships_id_fk" FOREIGN KEY ("recipient_membership_id") REFERENCES "public"."ranch_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ranch_direct_messages_ranch_idx" ON "ranch_direct_messages" USING btree ("ranch_id");--> statement-breakpoint
CREATE INDEX "ranch_direct_messages_sender_idx" ON "ranch_direct_messages" USING btree ("sender_membership_id");--> statement-breakpoint
CREATE INDEX "ranch_direct_messages_recipient_idx" ON "ranch_direct_messages" USING btree ("recipient_membership_id");--> statement-breakpoint
CREATE INDEX "ranch_direct_messages_created_idx" ON "ranch_direct_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ranch_direct_messages_unread_idx" ON "ranch_direct_messages" USING btree ("recipient_membership_id","is_read");