import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const ranchRoleEnum = pgEnum("ranch_role", ["owner", "manager", "worker"]);
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
export const payTypeEnum = pgEnum("pay_type", ["hourly", "salary"]);

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
    subscriptionStatus: subscriptionStatusEnum("subscription_status")
      .default("inactive")
      .notNull(),
    subscriptionPlanKey: text("subscription_plan_key"),
    betaLifetimeAccess: boolean("beta_lifetime_access").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("ranches_slug_idx").on(table.slug)],
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

export type RanchRole = (typeof ranchRoleEnum.enumValues)[number];
export type OnboardingState = (typeof onboardingStateEnum.enumValues)[number];
export type SubscriptionStatus = (typeof subscriptionStatusEnum.enumValues)[number];
export type PayType = (typeof payTypeEnum.enumValues)[number];
