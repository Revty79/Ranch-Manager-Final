ALTER TABLE "work_orders" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "cancelled_by_membership_id" uuid;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_cancelled_by_membership_id_ranch_memberships_id_fk" FOREIGN KEY ("cancelled_by_membership_id") REFERENCES "public"."ranch_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_orders_cancelled_idx" ON "work_orders" USING btree ("cancelled_at");