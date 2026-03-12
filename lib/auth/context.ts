import { and, eq, gt } from "drizzle-orm";
import { cache } from "react";
import { redirect } from "next/navigation";
import { hasBillingAccess } from "@/lib/billing/access";
import { db } from "@/lib/db/client";
import {
  ranchMemberships,
  ranches,
  sessions,
  users,
  type PayType,
  type RanchRole,
} from "@/lib/db/schema";
import { resolveTimeZone } from "@/lib/timezone";
import { getSessionTokenFromCookie, hashSessionToken } from "./session";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  mustResetPassword: boolean;
  onboardingState: "needs_ranch" | "complete";
  lastActiveRanchId: string | null;
  timeZone: string;
}

export interface RanchContext {
  ranch: {
    id: string;
    name: string;
    slug: string;
    onboardingCompleted: boolean;
    subscriptionStatus: string;
    subscriptionPlanKey: string | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    subscriptionCurrentPeriodEnd: Date | null;
    betaLifetimeAccess: boolean;
  };
  membership: {
    id: string;
    role: RanchRole;
    payType: PayType;
    isActive: boolean;
  };
}

export interface AppContext extends RanchContext {
  user: AuthUser;
}

async function getRanchContextForUser(
  userId: string,
  preferredRanchId: string | null,
): Promise<RanchContext | null> {
  const memberships = await db
    .select({
      membershipId: ranchMemberships.id,
      role: ranchMemberships.role,
      payType: ranchMemberships.payType,
      isActive: ranchMemberships.isActive,
      ranchId: ranches.id,
      ranchName: ranches.name,
      ranchSlug: ranches.slug,
      onboardingCompleted: ranches.onboardingCompleted,
      subscriptionStatus: ranches.subscriptionStatus,
      subscriptionPlanKey: ranches.subscriptionPlanKey,
      stripeCustomerId: ranches.stripeCustomerId,
      stripeSubscriptionId: ranches.stripeSubscriptionId,
      subscriptionCurrentPeriodEnd: ranches.subscriptionCurrentPeriodEnd,
      betaLifetimeAccess: ranches.betaLifetimeAccess,
    })
    .from(ranchMemberships)
    .innerJoin(ranches, eq(ranchMemberships.ranchId, ranches.id))
    .where(and(eq(ranchMemberships.userId, userId), eq(ranchMemberships.isActive, true)));

  if (!memberships.length) {
    return null;
  }

  const activeMembership =
    memberships.find((membership) => membership.ranchId === preferredRanchId) ??
    memberships[0];

  return {
    ranch: {
      id: activeMembership.ranchId,
      name: activeMembership.ranchName,
      slug: activeMembership.ranchSlug,
      onboardingCompleted: activeMembership.onboardingCompleted,
      subscriptionStatus: activeMembership.subscriptionStatus,
      subscriptionPlanKey: activeMembership.subscriptionPlanKey,
      stripeCustomerId: activeMembership.stripeCustomerId,
      stripeSubscriptionId: activeMembership.stripeSubscriptionId,
      subscriptionCurrentPeriodEnd: activeMembership.subscriptionCurrentPeriodEnd,
      betaLifetimeAccess: activeMembership.betaLifetimeAccess,
    },
    membership: {
      id: activeMembership.membershipId,
      role: activeMembership.role,
      payType: activeMembership.payType,
      isActive: activeMembership.isActive,
    },
  };
}

export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const token = await getSessionTokenFromCookie();
  if (!token) {
    return null;
  }

  const [sessionRow] = await db
    .select({
      userId: users.id,
      email: users.email,
      fullName: users.fullName,
      mustResetPassword: users.mustResetPassword,
      onboardingState: users.onboardingState,
      lastActiveRanchId: users.lastActiveRanchId,
      timeZone: users.timeZone,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, hashSessionToken(token)),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!sessionRow) {
    return null;
  }

  return {
    id: sessionRow.userId,
    email: sessionRow.email,
    fullName: sessionRow.fullName,
    mustResetPassword: sessionRow.mustResetPassword,
    onboardingState: sessionRow.onboardingState,
    lastActiveRanchId: sessionRow.lastActiveRanchId,
    timeZone: resolveTimeZone(sessionRow.timeZone),
  };
});

export const getCurrentRanchContext = cache(async (): Promise<RanchContext | null> => {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  return getRanchContextForUser(user.id, user.lastActiveRanchId);
});

export async function getPostAuthRedirectPath(user: AuthUser): Promise<string> {
  if (user.mustResetPassword) {
    return "/reset-password";
  }

  const ranchContext = await getRanchContextForUser(user.id, user.lastActiveRanchId);
  if (!ranchContext || !ranchContext.ranch.onboardingCompleted) {
    return "/onboarding";
  }

  if (!hasBillingAccess(ranchContext.ranch)) {
    return "/app/billing-required";
  }

  return "/app";
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireAppContext(): Promise<AppContext> {
  const user = await requireUser();
  if (user.mustResetPassword) {
    redirect("/reset-password");
  }

  const ranchContext = await getRanchContextForUser(user.id, user.lastActiveRanchId);

  if (!ranchContext || !ranchContext.ranch.onboardingCompleted) {
    redirect("/onboarding");
  }

  return {
    user,
    ...ranchContext,
  };
}

export async function requirePaidAccessContext(): Promise<AppContext> {
  const context = await requireAppContext();
  if (!hasBillingAccess(context.ranch)) {
    redirect("/app/billing-required");
  }

  return context;
}

export async function requireRole(
  allowedRoles: RanchRole[],
  options?: { requirePaid?: boolean },
): Promise<AppContext> {
  const context =
    options?.requirePaid === false
      ? await requireAppContext()
      : await requirePaidAccessContext();
  if (!allowedRoles.includes(context.membership.role)) {
    redirect("/app/access-denied");
  }

  return context;
}

export function roleCanManageOperations(role: RanchRole): boolean {
  return role === "owner" || role === "manager";
}
