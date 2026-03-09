import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  billingCouponRedemptions,
  billingCoupons,
  ranchMemberships,
  ranches,
  users,
} from "@/lib/db/schema";

export async function getAdminUsers() {
  return db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      onboardingState: users.onboardingState,
      lastActiveRanchId: users.lastActiveRanchId,
      createdAt: users.createdAt,
      membershipCount: sql<number>`count(${ranchMemberships.id})::int`,
    })
    .from(users)
    .leftJoin(ranchMemberships, eq(users.id, ranchMemberships.userId))
    .groupBy(users.id)
    .orderBy(desc(users.createdAt))
    .limit(250);
}

export async function getAdminRanches() {
  return db
    .select({
      id: ranches.id,
      name: ranches.name,
      slug: ranches.slug,
      subscriptionStatus: ranches.subscriptionStatus,
      betaLifetimeAccess: ranches.betaLifetimeAccess,
      createdAt: ranches.createdAt,
      stripeCustomerId: ranches.stripeCustomerId,
      stripeSubscriptionId: ranches.stripeSubscriptionId,
      activeMemberCount:
        sql<number>`sum(case when ${ranchMemberships.isActive} then 1 else 0 end)::int`,
      ownerCount:
        sql<number>`sum(case when ${ranchMemberships.role} = 'owner' and ${ranchMemberships.isActive} then 1 else 0 end)::int`,
    })
    .from(ranches)
    .leftJoin(ranchMemberships, eq(ranches.id, ranchMemberships.ranchId))
    .groupBy(ranches.id)
    .orderBy(desc(ranches.createdAt))
    .limit(250);
}

export async function getAdminCoupons() {
  return db
    .select({
      id: billingCoupons.id,
      name: billingCoupons.name,
      grantType: billingCoupons.grantType,
      isActive: billingCoupons.isActive,
      maxRedemptions: billingCoupons.maxRedemptions,
      expiresAt: billingCoupons.expiresAt,
      createdAt: billingCoupons.createdAt,
      redemptionCount: sql<number>`count(${billingCouponRedemptions.id})::int`,
    })
    .from(billingCoupons)
    .leftJoin(
      billingCouponRedemptions,
      eq(billingCoupons.id, billingCouponRedemptions.couponId),
    )
    .groupBy(billingCoupons.id)
    .orderBy(desc(billingCoupons.createdAt))
    .limit(250);
}
