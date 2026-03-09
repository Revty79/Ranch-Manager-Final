ALTER TABLE "shifts" ADD COLUMN "paused_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "paused_accumulated_seconds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "shifts_paused_idx" ON "shifts" USING btree ("paused_at");