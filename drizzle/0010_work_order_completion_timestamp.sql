ALTER TABLE "work_orders" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "work_orders_completed_idx" ON "work_orders" USING btree ("completed_at");