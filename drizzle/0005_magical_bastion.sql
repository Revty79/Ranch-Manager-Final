ALTER TABLE "ranches" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "ranches" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "ranches" ADD COLUMN "subscription_current_period_end" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ranches" ADD COLUMN "subscription_updated_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "ranches_stripe_customer_uidx" ON "ranches" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ranches_stripe_subscription_uidx" ON "ranches" USING btree ("stripe_subscription_id");