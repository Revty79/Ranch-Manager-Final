ALTER TABLE "ranch_direct_messages" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ranch_messages" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "ranch_direct_messages_archived_idx" ON "ranch_direct_messages" USING btree ("ranch_id","archived_at");--> statement-breakpoint
CREATE INDEX "ranch_messages_archived_idx" ON "ranch_messages" USING btree ("ranch_id","archived_at");