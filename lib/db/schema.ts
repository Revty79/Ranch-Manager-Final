import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const ranchRoleEnum = pgEnum("ranch_role", [
  "owner",
  "manager",
  "worker",
  "seasonal_worker",
]);
export const onboardingStateEnum = pgEnum("onboarding_state", [
  "needs_ranch",
  "complete",
]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "inactive",
  "trialing",
  "active",
  "past_due",
  "canceled",
]);
export const couponGrantTypeEnum = pgEnum("coupon_grant_type", [
  "beta_lifetime_access",
]);
export const payTypeEnum = pgEnum("pay_type", ["hourly", "salary", "piece_work"]);
export const workOrderStatusEnum = pgEnum("work_order_status", [
  "draft",
  "open",
  "in_progress",
  "completed",
  "cancelled",
]);
export const workOrderPriorityEnum = pgEnum("work_order_priority", [
  "low",
  "normal",
  "high",
]);
export const workOrderIncentiveTimerTypeEnum = pgEnum("work_order_incentive_timer_type", [
  "none",
  "hours",
  "deadline",
]);
export const payrollPeriodStatusEnum = pgEnum("payroll_period_status", ["open", "paid"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull().unique(),
    fullName: text("full_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    onboardingState: onboardingStateEnum("onboarding_state")
      .default("needs_ranch")
      .notNull(),
    lastActiveRanchId: uuid("last_active_ranch_id"),
    timeZone: text("time_zone").default("UTC").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("users_email_idx").on(table.email)],
);

export const ranches = pgTable(
  "ranches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    subscriptionStatus: subscriptionStatusEnum("subscription_status")
      .default("inactive")
      .notNull(),
    subscriptionPlanKey: text("subscription_plan_key"),
    subscriptionCurrentPeriodEnd: timestamp("subscription_current_period_end", {
      withTimezone: true,
    }),
    subscriptionUpdatedAt: timestamp("subscription_updated_at", { withTimezone: true }),
    betaLifetimeAccess: boolean("beta_lifetime_access").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("ranches_slug_idx").on(table.slug),
    uniqueIndex("ranches_stripe_customer_uidx").on(table.stripeCustomerId),
    uniqueIndex("ranches_stripe_subscription_uidx").on(table.stripeSubscriptionId),
  ],
);

export const ranchMemberships = pgTable(
  "ranch_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ranchId: uuid("ranch_id")
      .references(() => ranches.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    role: ranchRoleEnum("role").default("worker").notNull(),
    payType: payTypeEnum("pay_type").default("hourly").notNull(),
    payRateCents: integer("pay_rate_cents").default(0).notNull(),
    payAdvanceCents: integer("pay_advance_cents").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("ranch_memberships_ranch_idx").on(table.ranchId),
    index("ranch_memberships_user_idx").on(table.userId),
    uniqueIndex("ranch_memberships_ranch_user_uidx").on(table.ranchId, table.userId),
  ],
);

export const billingCoupons = pgTable(
  "billing_coupons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    codeHash: text("code_hash").notNull().unique(),
    grantType: couponGrantTypeEnum("grant_type")
      .default("beta_lifetime_access")
      .notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    maxRedemptions: integer("max_redemptions"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("billing_coupons_active_idx").on(table.isActive)],
);

export const billingCouponRedemptions = pgTable(
  "billing_coupon_redemptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    couponId: uuid("coupon_id")
      .references(() => billingCoupons.id, { onDelete: "cascade" })
      .notNull(),
    ranchId: uuid("ranch_id")
      .references(() => ranches.id, { onDelete: "cascade" })
      .notNull(),
    redeemedByUserId: uuid("redeemed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("billing_coupon_redemptions_coupon_idx").on(table.couponId),
    index("billing_coupon_redemptions_ranch_idx").on(table.ranchId),
    uniqueIndex("billing_coupon_redemptions_coupon_ranch_uidx").on(
      table.couponId,
      table.ranchId,
    ),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("sessions_user_idx").on(table.userId),
    index("sessions_expires_idx").on(table.expiresAt),
  ],
);

export const workOrders = pgTable(
  "work_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ranchId: uuid("ranch_id")
      .references(() => ranches.id, { onDelete: "cascade" })
      .notNull(),
    title: text("title").notNull(),
    description: text("description"),
    status: workOrderStatusEnum("status").default("draft").notNull(),
    priority: workOrderPriorityEnum("priority").default("normal").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    incentivePayCents: integer("incentive_pay_cents").default(0).notNull(),
    incentiveTimerType: workOrderIncentiveTimerTypeEnum("incentive_timer_type")
      .default("none")
      .notNull(),
    incentiveDurationHours: integer("incentive_duration_hours"),
    incentiveEndsAt: timestamp("incentive_ends_at", { withTimezone: true }),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => ranchMemberships.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("work_orders_ranch_idx").on(table.ranchId),
    index("work_orders_status_idx").on(table.status),
    index("work_orders_due_idx").on(table.dueAt),
    index("work_orders_completed_idx").on(table.completedAt),
    index("work_orders_incentive_ends_idx").on(table.incentiveEndsAt),
  ],
);

export const workOrderAssignments = pgTable(
  "work_order_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workOrderId: uuid("work_order_id")
      .references(() => workOrders.id, { onDelete: "cascade" })
      .notNull(),
    membershipId: uuid("membership_id")
      .references(() => ranchMemberships.id, { onDelete: "cascade" })
      .notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("work_order_assignments_work_order_idx").on(table.workOrderId),
    index("work_order_assignments_membership_idx").on(table.membershipId),
    uniqueIndex("work_order_assignment_unique").on(table.workOrderId, table.membershipId),
  ],
);

export const shifts = pgTable(
  "shifts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ranchId: uuid("ranch_id")
      .references(() => ranches.id, { onDelete: "cascade" })
      .notNull(),
    membershipId: uuid("membership_id")
      .references(() => ranchMemberships.id, { onDelete: "cascade" })
      .notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    pausedAccumulatedSeconds: integer("paused_accumulated_seconds")
      .default(0)
      .notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("shifts_ranch_idx").on(table.ranchId),
    index("shifts_membership_idx").on(table.membershipId),
    index("shifts_started_idx").on(table.startedAt),
    index("shifts_paused_idx").on(table.pausedAt),
  ],
);

export const workTimeEntries = pgTable(
  "work_time_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ranchId: uuid("ranch_id")
      .references(() => ranches.id, { onDelete: "cascade" })
      .notNull(),
    membershipId: uuid("membership_id")
      .references(() => ranchMemberships.id, { onDelete: "cascade" })
      .notNull(),
    workOrderId: uuid("work_order_id")
      .references(() => workOrders.id, { onDelete: "cascade" })
      .notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("work_time_entries_ranch_idx").on(table.ranchId),
    index("work_time_entries_membership_idx").on(table.membershipId),
    index("work_time_entries_work_order_idx").on(table.workOrderId),
    index("work_time_entries_started_idx").on(table.startedAt),
  ],
);

export const payrollSettings = pgTable(
  "payroll_settings",
  {
    ranchId: uuid("ranch_id")
      .references(() => ranches.id, { onDelete: "cascade" })
      .primaryKey(),
    anchorStartDate: date("anchor_start_date", { mode: "string" }).notNull(),
    periodLengthDays: integer("period_length_days").default(14).notNull(),
    paydayOffsetDays: integer("payday_offset_days").default(5).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("payroll_settings_anchor_idx").on(table.anchorStartDate)],
);

export const payrollPeriods = pgTable(
  "payroll_periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ranchId: uuid("ranch_id")
      .references(() => ranches.id, { onDelete: "cascade" })
      .notNull(),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    payDate: date("pay_date", { mode: "string" }).notNull(),
    status: payrollPeriodStatusEnum("status").default("open").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("payroll_periods_ranch_idx").on(table.ranchId),
    index("payroll_periods_start_idx").on(table.periodStart),
    index("payroll_periods_pay_date_idx").on(table.payDate),
    uniqueIndex("payroll_periods_ranch_start_uidx").on(table.ranchId, table.periodStart),
  ],
);

export const payrollPeriodAdvances = pgTable(
  "payroll_period_advances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ranchId: uuid("ranch_id")
      .references(() => ranches.id, { onDelete: "cascade" })
      .notNull(),
    periodId: uuid("period_id")
      .references(() => payrollPeriods.id, { onDelete: "cascade" })
      .notNull(),
    membershipId: uuid("membership_id")
      .references(() => ranchMemberships.id, { onDelete: "cascade" })
      .notNull(),
    amountCents: integer("amount_cents").notNull(),
    note: text("note"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => ranchMemberships.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("payroll_period_advances_ranch_idx").on(table.ranchId),
    index("payroll_period_advances_period_idx").on(table.periodId),
    index("payroll_period_advances_member_idx").on(table.membershipId),
  ],
);

export const payrollPeriodMemberReceipts = pgTable(
  "payroll_period_member_receipts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ranchId: uuid("ranch_id")
      .references(() => ranches.id, { onDelete: "cascade" })
      .notNull(),
    periodId: uuid("period_id")
      .references(() => payrollPeriods.id, { onDelete: "cascade" })
      .notNull(),
    membershipId: uuid("membership_id")
      .references(() => ranchMemberships.id, { onDelete: "cascade" })
      .notNull(),
    isCheckPickedUp: boolean("is_check_picked_up").default(false).notNull(),
    pickedUpAt: timestamp("picked_up_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("payroll_period_receipts_ranch_idx").on(table.ranchId),
    index("payroll_period_receipts_period_idx").on(table.periodId),
    uniqueIndex("payroll_period_receipts_period_member_uidx").on(
      table.periodId,
      table.membershipId,
    ),
  ],
);

export type RanchRole = (typeof ranchRoleEnum.enumValues)[number];
export type OnboardingState = (typeof onboardingStateEnum.enumValues)[number];
export type SubscriptionStatus = (typeof subscriptionStatusEnum.enumValues)[number];
export type CouponGrantType = (typeof couponGrantTypeEnum.enumValues)[number];
export type PayType = (typeof payTypeEnum.enumValues)[number];
export type WorkOrderStatus = (typeof workOrderStatusEnum.enumValues)[number];
export type WorkOrderPriority = (typeof workOrderPriorityEnum.enumValues)[number];
export type WorkOrderIncentiveTimerType =
  (typeof workOrderIncentiveTimerTypeEnum.enumValues)[number];
export type PayrollPeriodStatus = (typeof payrollPeriodStatusEnum.enumValues)[number];
