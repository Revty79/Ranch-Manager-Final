CREATE TYPE "public"."coupon_grant_type" AS ENUM('beta_lifetime_access');--> statement-breakpoint
CREATE TABLE "billing_coupon_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coupon_id" uuid NOT NULL,
	"ranch_id" uuid NOT NULL,
	"redeemed_by_user_id" uuid,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code_hash" text NOT NULL,
	"grant_type" "coupon_grant_type" DEFAULT 'beta_lifetime_access' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"max_redemptions" integer,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_coupons_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
ALTER TABLE "billing_coupon_redemptions" ADD CONSTRAINT "billing_coupon_redemptions_coupon_id_billing_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."billing_coupons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_coupon_redemptions" ADD CONSTRAINT "billing_coupon_redemptions_ranch_id_ranches_id_fk" FOREIGN KEY ("ranch_id") REFERENCES "public"."ranches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_coupon_redemptions" ADD CONSTRAINT "billing_coupon_redemptions_redeemed_by_user_id_users_id_fk" FOREIGN KEY ("redeemed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_coupon_redemptions_coupon_idx" ON "billing_coupon_redemptions" USING btree ("coupon_id");--> statement-breakpoint
CREATE INDEX "billing_coupon_redemptions_ranch_idx" ON "billing_coupon_redemptions" USING btree ("ranch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_coupon_redemptions_coupon_ranch_uidx" ON "billing_coupon_redemptions" USING btree ("coupon_id","ranch_id");--> statement-breakpoint
CREATE INDEX "billing_coupons_active_idx" ON "billing_coupons" USING btree ("is_active");