CREATE TYPE "public"."work_order_completion_review_status" AS ENUM('pending', 'approved', 'changes_requested');--> statement-breakpoint
CREATE TABLE "work_order_completion_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ranch_id" uuid NOT NULL,
	"work_order_id" uuid NOT NULL,
	"requested_by_membership_id" uuid,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "work_order_completion_review_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by_membership_id" uuid,
	"reviewed_at" timestamp with time zone,
	"manager_notes" text,
	"checklist_completion_verified" boolean DEFAULT false NOT NULL,
	"checklist_quality_verified" boolean DEFAULT false NOT NULL,
	"checklist_cleanup_verified" boolean DEFAULT false NOT NULL,
	"checklist_follow_up_verified" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "work_order_completion_reviews" ADD CONSTRAINT "work_order_completion_reviews_ranch_id_ranches_id_fk" FOREIGN KEY ("ranch_id") REFERENCES "public"."ranches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_completion_reviews" ADD CONSTRAINT "work_order_completion_reviews_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_completion_reviews" ADD CONSTRAINT "work_order_completion_reviews_requested_by_membership_id_ranch_memberships_id_fk" FOREIGN KEY ("requested_by_membership_id") REFERENCES "public"."ranch_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_completion_reviews" ADD CONSTRAINT "work_order_completion_reviews_reviewed_by_membership_id_ranch_memberships_id_fk" FOREIGN KEY ("reviewed_by_membership_id") REFERENCES "public"."ranch_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_order_completion_reviews_ranch_idx" ON "work_order_completion_reviews" USING btree ("ranch_id");--> statement-breakpoint
CREATE INDEX "work_order_completion_reviews_status_idx" ON "work_order_completion_reviews" USING btree ("status");--> statement-breakpoint
CREATE INDEX "work_order_completion_reviews_requested_idx" ON "work_order_completion_reviews" USING btree ("requested_at");--> statement-breakpoint
CREATE UNIQUE INDEX "work_order_completion_reviews_work_order_uidx" ON "work_order_completion_reviews" USING btree ("work_order_id");