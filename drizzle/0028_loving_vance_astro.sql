CREATE TYPE "public"."work_order_completion_evidence_type" AS ENUM('link', 'photo', 'file', 'note');--> statement-breakpoint
CREATE TABLE "work_order_completion_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ranch_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	"evidence_type" "work_order_completion_evidence_type" DEFAULT 'link' NOT NULL,
	"label" text,
	"url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_order_completion_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ranch_id" uuid NOT NULL,
	"work_order_id" uuid NOT NULL,
	"submitted_by_membership_id" uuid,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completion_note" text,
	"checklist_scope_completed" boolean DEFAULT false NOT NULL,
	"checklist_quality_checked" boolean DEFAULT false NOT NULL,
	"checklist_cleanup_completed" boolean DEFAULT false NOT NULL,
	"checklist_follow_up_noted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "work_order_completion_evidence" ADD CONSTRAINT "work_order_completion_evidence_ranch_id_ranches_id_fk" FOREIGN KEY ("ranch_id") REFERENCES "public"."ranches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_completion_evidence" ADD CONSTRAINT "work_order_completion_evidence_submission_id_work_order_completion_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."work_order_completion_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_completion_submissions" ADD CONSTRAINT "work_order_completion_submissions_ranch_id_ranches_id_fk" FOREIGN KEY ("ranch_id") REFERENCES "public"."ranches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_completion_submissions" ADD CONSTRAINT "work_order_completion_submissions_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_completion_submissions" ADD CONSTRAINT "work_order_completion_submissions_submitted_by_membership_id_ranch_memberships_id_fk" FOREIGN KEY ("submitted_by_membership_id") REFERENCES "public"."ranch_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_order_completion_evidence_ranch_idx" ON "work_order_completion_evidence" USING btree ("ranch_id");--> statement-breakpoint
CREATE INDEX "work_order_completion_evidence_submission_idx" ON "work_order_completion_evidence" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "work_order_completion_submissions_ranch_idx" ON "work_order_completion_submissions" USING btree ("ranch_id");--> statement-breakpoint
CREATE INDEX "work_order_completion_submissions_work_order_idx" ON "work_order_completion_submissions" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "work_order_completion_submissions_submitted_idx" ON "work_order_completion_submissions" USING btree ("submitted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "work_order_completion_submissions_work_order_uidx" ON "work_order_completion_submissions" USING btree ("work_order_id");