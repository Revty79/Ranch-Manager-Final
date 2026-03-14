import { sql } from "drizzle-orm";
import {
  AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
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
export const animalSpeciesEnum = pgEnum("animal_species", [
  "cattle",
  "horse",
  "bison",
  "sheep",
  "goat",
  "swine",
  "donkey",
  "mule",
  "llama",
  "alpaca",
  "poultry",
  "other",
]);
export const animalSexEnum = pgEnum("animal_sex", [
  "female",
  "male",
  "castrated_male",
  "unknown",
]);
export const animalStatusEnum = pgEnum("animal_status", [
  "active",
  "sold",
  "deceased",
  "culled",
  "transferred",
  "archived",
]);
export const animalGroupTypeEnum = pgEnum("animal_group_type", [
  "management",
  "breeding",
  "health",
  "marketing",
  "custom",
]);
export const animalEventTypeEnum = pgEnum("animal_event_type", [
  "birth",
  "acquisition",
  "breeding",
  "pregnancy_check",
  "vaccination",
  "treatment",
  "deworming",
  "movement",
  "death",
  "sale_disposition",
  "cull",
  "note",
]);
export const landUnitTypeEnum = pgEnum("land_unit_type", [
  "pasture",
  "field",
  "trap",
  "lot",
  "corral",
  "pen",
  "stall",
  "barn_area",
  "holding_area",
  "other",
]);
export const movementReasonEnum = pgEnum("movement_reason", [
  "grazing_rotation",
  "feeding",
  "breeding",
  "health_hold",
  "weaning",
  "training",
  "weather",
  "other",
]);
export const herdProtocolTypeEnum = pgEnum("herd_protocol_type", [
  "vaccination",
  "deworming",
  "pregnancy_check",
  "pre_breeding",
  "pre_birth_planning",
]);
export const grazingPeriodStatusEnum = pgEnum("grazing_period_status", [
  "planned",
  "active",
  "completed",
  "cancelled",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull().unique(),
    fullName: text("full_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    mustResetPassword: boolean("must_reset_password").default(false).notNull(),
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

export const animals = pgTable(
  "animals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ranchId: uuid("ranch_id")
      .references(() => ranches.id, { onDelete: "cascade" })
      .notNull(),
    internalId: text("internal_id").notNull(),
    tagId: text("tag_id").notNull(),
    alternateId: text("alternate_id"),
    displayName: text("display_name"),
    species: animalSpeciesEnum("species").default("cattle").notNull(),
    sex: animalSexEnum("sex").default("unknown").notNull(),
    animalClass: text("animal_class"),
    breed: text("breed"),
    colorMarkings: text("color_markings"),
    status: animalStatusEnum("status").default("active").notNull(),
    birthDate: date("birth_date", { mode: "string" }),
    isBirthDateEstimated: boolean("is_birth_date_estimated").default(false).notNull(),
    sireAnimalId: uuid("sire_animal_id").references((): AnyPgColumn => animals.id, {
      onDelete: "set null",
    }),
    damAnimalId: uuid("dam_animal_id").references((): AnyPgColumn => animals.id, {
      onDelete: "set null",
    }),
    acquiredOn: date("acquired_on", { mode: "string" }),
    acquisitionMethod: text("acquisition_method"),
    acquisitionSource: text("acquisition_source"),
    dispositionOn: date("disposition_on", { mode: "string" }),
    dispositionReason: text("disposition_reason"),
    isArchived: boolean("is_archived").default(false).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("animals_ranch_idx").on(table.ranchId),
    index("animals_status_idx").on(table.status),
    index("animals_species_idx").on(table.species),
    index("animals_birth_idx").on(table.birthDate),
    index("animals_sire_idx").on(table.sireAnimalId),
    index("animals_dam_idx").on(table.damAnimalId),
    uniqueIndex("animals_ranch_internal_id_uidx").on(table.ranchId, table.internalId),
    uniqueIndex("animals_ranch_tag_uidx").on(table.ranchId, table.tagId),
    uniqueIndex("animals_ranch_alt_id_uidx")
      .on(table.ranchId, table.alternateId)
      .where(sql`${table.alternateId} is not null`),
  ],
);

export const animalGroups = pgTable(
  "animal_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ranchId: uuid("ranch_id")
      .references(() => ranches.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    groupType: animalGroupTypeEnum("group_type").default("management").notNull(),
    description: text("description"),
    notes: text("notes"),
    isActive: boolean("is_active").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("animal_groups_ranch_idx").on(table.ranchId),
    index("animal_groups_active_idx").on(table.isActive),
    uniqueIndex("animal_groups_ranch_name_uidx").on(table.ranchId, table.name),
  ],
);

export const animalGroupMemberships = pgTable(
  "animal_group_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ranchId: uuid("ranch_id")
      .references(() => ranches.id, { onDelete: "cascade" })
      .notNull(),
    animalGroupId: uuid("animal_group_id")
      .references(() => animalGroups.id, { onDelete: "cascade" })
      .notNull(),
    animalId: uuid("animal_id")
      .references(() => animals.id, { onDelete: "cascade" })
      .notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    leftAt: timestamp("left_at", { withTimezone: true }),
    isActive: boolean("is_active").default(true).notNull(),
    membershipNote: text("membership_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("animal_group_memberships_ranch_idx").on(table.ranchId),
    index("animal_group_memberships_group_idx").on(table.animalGroupId),
    index("animal_group_memberships_animal_idx").on(table.animalId),
    index("animal_group_memberships_active_idx").on(table.isActive),
    uniqueIndex("animal_group_memberships_active_uidx")
      .on(table.animalGroupId, table.animalId)
      .where(sql`${table.isActive} = true`),
  ],
);

export const animalEvents = pgTable(
  "animal_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ranchId: uuid("ranch_id")
      .references(() => ranches.id, { onDelete: "cascade" })
      .notNull(),
    animalId: uuid("animal_id")
      .references(() => animals.id, { onDelete: "cascade" })
      .notNull(),
    animalGroupId: uuid("animal_group_id").references(() => animalGroups.id, {
      onDelete: "set null",
    }),
    eventType: animalEventTypeEnum("event_type").default("note").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    summary: text("summary").notNull(),
    details: text("details"),
    eventData: jsonb("event_data")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    recordedByMembershipId: uuid("recorded_by_membership_id").references(
      () => ranchMemberships.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("animal_events_ranch_idx").on(table.ranchId),
    index("animal_events_animal_idx").on(table.animalId),
    index("animal_events_group_idx").on(table.animalGroupId),
    index("animal_events_type_idx").on(table.eventType),
    index("animal_events_occurred_idx").on(table.occurredAt),
  ],
);

export const landUnits = pgTable(
  "land_units",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ranchId: uuid("ranch_id")
      .references(() => ranches.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    code: text("code"),
    unitType: landUnitTypeEnum("unit_type").default("pasture").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    acreage: numeric("acreage", { precision: 10, scale: 2 }),
    grazeableAcreage: numeric("grazeable_acreage", { precision: 10, scale: 2 }),
    estimatedForageLbsPerAcre: numeric("estimated_forage_lbs_per_acre", {
      precision: 10,
      scale: 2,
    }),
    targetUtilizationPercent: integer("target_utilization_percent"),
    targetRestDays: integer("target_rest_days"),
    sortOrder: integer("sort_order").default(0).notNull(),
    waterSummary: text("water_summary"),
    fencingSummary: text("fencing_summary"),
    seasonalNotes: text("seasonal_notes"),
    currentUse: text("current_use"),
    currentStatus: text("current_status"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("land_units_ranch_idx").on(table.ranchId),
    index("land_units_type_idx").on(table.unitType),
    index("land_units_active_idx").on(table.isActive),
    index("land_units_sort_idx").on(table.sortOrder),
    uniqueIndex("land_units_ranch_code_uidx")
      .on(table.ranchId, table.code)
      .where(sql`${table.code} is not null`),
  ],
);

export const animalLocationAssignments = pgTable(
  "animal_location_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ranchId: uuid("ranch_id")
      .references(() => ranches.id, { onDelete: "cascade" })
      .notNull(),
    animalId: uuid("animal_id")
      .references(() => animals.id, { onDelete: "cascade" })
      .notNull(),
    landUnitId: uuid("land_unit_id")
      .references(() => landUnits.id, { onDelete: "cascade" })
      .notNull(),
    movementReason: movementReasonEnum("movement_reason").default("other").notNull(),
    movementBatchKey: text("movement_batch_key"),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    isActive: boolean("is_active").default(true).notNull(),
    notes: text("notes"),
    assignedByMembershipId: uuid("assigned_by_membership_id").references(
      () => ranchMemberships.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("animal_location_assignments_ranch_idx").on(table.ranchId),
    index("animal_location_assignments_animal_idx").on(table.animalId),
    index("animal_location_assignments_land_idx").on(table.landUnitId),
    index("animal_location_assignments_active_idx").on(table.ranchId, table.isActive),
    index("animal_location_assignments_occupancy_idx").on(
      table.ranchId,
      table.landUnitId,
      table.isActive,
    ),
    index("animal_location_assignments_assigned_idx").on(table.assignedAt),
    uniqueIndex("animal_location_assignments_active_uidx")
      .on(table.animalId)
      .where(sql`${table.isActive} = true`),
  ],
);

export const herdLandSettings = pgTable("herd_land_settings", {
  ranchId: uuid("ranch_id")
    .references(() => ranches.id, { onDelete: "cascade" })
    .primaryKey(),
  speciesDefaults: jsonb("species_defaults")
    .$type<Record<string, unknown>>()
    .default(sql`'{}'::jsonb`)
    .notNull(),
  reproductiveDefaults: jsonb("reproductive_defaults")
    .$type<Record<string, unknown>>()
    .default(sql`'{}'::jsonb`)
    .notNull(),
  grazingDefaults: jsonb("grazing_defaults")
    .$type<Record<string, unknown>>()
    .default(sql`'{}'::jsonb`)
    .notNull(),
  calculationDefaults: jsonb("calculation_defaults")
    .$type<Record<string, unknown>>()
    .default(sql`'{}'::jsonb`)
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const herdProtocolTemplates = pgTable(
  "herd_protocol_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ranchId: uuid("ranch_id")
      .references(() => ranches.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    protocolType: herdProtocolTypeEnum("protocol_type").notNull(),
    species: animalSpeciesEnum("species"),
    sex: animalSexEnum("sex"),
    intervalDays: integer("interval_days").notNull(),
    dueSoonDays: integer("due_soon_days").default(14).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("herd_protocol_templates_ranch_idx").on(table.ranchId),
    index("herd_protocol_templates_active_idx").on(table.isActive),
    index("herd_protocol_templates_type_idx").on(table.protocolType),
  ],
);

export const grazingPeriods = pgTable(
  "grazing_periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ranchId: uuid("ranch_id")
      .references(() => ranches.id, { onDelete: "cascade" })
      .notNull(),
    landUnitId: uuid("land_unit_id")
      .references(() => landUnits.id, { onDelete: "cascade" })
      .notNull(),
    animalGroupId: uuid("animal_group_id").references(() => animalGroups.id, {
      onDelete: "set null",
    }),
    status: grazingPeriodStatusEnum("status").default("active").notNull(),
    startedOn: date("started_on", { mode: "string" }).notNull(),
    endedOn: date("ended_on", { mode: "string" }),
    plannedMoveOn: date("planned_move_on", { mode: "string" }),
    notes: text("notes"),
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
    index("grazing_periods_ranch_idx").on(table.ranchId),
    index("grazing_periods_land_unit_idx").on(table.landUnitId),
    index("grazing_periods_status_idx").on(table.status),
    index("grazing_periods_started_on_idx").on(table.startedOn),
  ],
);

export const grazingPeriodAnimals = pgTable(
  "grazing_period_animals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ranchId: uuid("ranch_id")
      .references(() => ranches.id, { onDelete: "cascade" })
      .notNull(),
    grazingPeriodId: uuid("grazing_period_id")
      .references(() => grazingPeriods.id, { onDelete: "cascade" })
      .notNull(),
    animalId: uuid("animal_id")
      .references(() => animals.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("grazing_period_animals_ranch_idx").on(table.ranchId),
    index("grazing_period_animals_period_idx").on(table.grazingPeriodId),
    index("grazing_period_animals_animal_idx").on(table.animalId),
    uniqueIndex("grazing_period_animals_period_animal_uidx").on(
      table.grazingPeriodId,
      table.animalId,
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
export type AnimalSpecies = (typeof animalSpeciesEnum.enumValues)[number];
export type AnimalSex = (typeof animalSexEnum.enumValues)[number];
export type AnimalStatus = (typeof animalStatusEnum.enumValues)[number];
export type AnimalGroupType = (typeof animalGroupTypeEnum.enumValues)[number];
export type AnimalEventType = (typeof animalEventTypeEnum.enumValues)[number];
export type LandUnitType = (typeof landUnitTypeEnum.enumValues)[number];
export type MovementReason = (typeof movementReasonEnum.enumValues)[number];
export type HerdProtocolType = (typeof herdProtocolTypeEnum.enumValues)[number];
export type GrazingPeriodStatus = (typeof grazingPeriodStatusEnum.enumValues)[number];
