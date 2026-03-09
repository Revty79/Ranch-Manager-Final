CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ranch_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ranch_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"work_order_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_ranch_id_ranches_id_fk" FOREIGN KEY ("ranch_id") REFERENCES "public"."ranches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_membership_id_ranch_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."ranch_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_time_entries" ADD CONSTRAINT "work_time_entries_ranch_id_ranches_id_fk" FOREIGN KEY ("ranch_id") REFERENCES "public"."ranches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_time_entries" ADD CONSTRAINT "work_time_entries_membership_id_ranch_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."ranch_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_time_entries" ADD CONSTRAINT "work_time_entries_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shifts_ranch_idx" ON "shifts" USING btree ("ranch_id");--> statement-breakpoint
CREATE INDEX "shifts_membership_idx" ON "shifts" USING btree ("membership_id");--> statement-breakpoint
CREATE INDEX "shifts_started_idx" ON "shifts" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "work_time_entries_ranch_idx" ON "work_time_entries" USING btree ("ranch_id");--> statement-breakpoint
CREATE INDEX "work_time_entries_membership_idx" ON "work_time_entries" USING btree ("membership_id");--> statement-breakpoint
CREATE INDEX "work_time_entries_work_order_idx" ON "work_time_entries" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "work_time_entries_started_idx" ON "work_time_entries" USING btree ("started_at");