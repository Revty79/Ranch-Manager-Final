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
import {
  hasSectionAccess,
  resolvePreferredAppPath,
  resolveSectionAccess,
  type AppSection,
  type MembershipCapabilityOverrides,
  type SectionAccessLevel,
  type SectionAccessMap,
} from "./capabilities";
import { isPlatformAdminEmail } from "./platform-admin-emails";
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
    timeZone: string;
    onboardingCompleted: boolean;
    subscriptionStatus: string;
    subscriptionPlanKey: string | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    subscriptionCurrentPeriodEnd: Date | null;
    betaLifetimeAccess: boolean;
    allowPlatformAdminAccess: boolean;
  };
  membership: {
    id: string;
    role: RanchRole;
    capabilityOverrides: MembershipCapabilityOverrides;
    sectionAccess: SectionAccessMap;
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
  isPlatformAdmin = false,
): Promise<RanchContext | null> {
  const memberships = await db
    .select({
      membershipId: ranchMemberships.id,
      role: ranchMemberships.role,
      capabilityOverrides: ranchMemberships.capabilityOverrides,
      payType: ranchMemberships.payType,
      isActive: ranchMemberships.isActive,
      ranchId: ranches.id,
      ranchName: ranches.name,
      ranchSlug: ranches.slug,
      ranchTimeZone: ranches.timeZone,
      onboardingCompleted: ranches.onboardingCompleted,
      subscriptionStatus: ranches.subscriptionStatus,
      subscriptionPlanKey: ranches.subscriptionPlanKey,
      stripeCustomerId: ranches.stripeCustomerId,
      stripeSubscriptionId: ranches.stripeSubscriptionId,
      subscriptionCurrentPeriodEnd: ranches.subscriptionCurrentPeriodEnd,
      betaLifetimeAccess: ranches.betaLifetimeAccess,
      allowPlatformAdminAccess: ranches.allowPlatformAdminAccess,
    })
    .from(ranchMemberships)
    .innerJoin(ranches, eq(ranchMemberships.ranchId, ranches.id))
    .where(and(eq(ranchMemberships.userId, userId), eq(ranchMemberships.isActive, true)));

  const eligibleMemberships = isPlatformAdmin
    ? memberships.filter((membership) => membership.allowPlatformAdminAccess)
    : memberships;

  if (!eligibleMemberships.length) {
    return null;
  }

  const activeMembership =
    eligibleMemberships.find((membership) => membership.ranchId === preferredRanchId) ??
    eligibleMemberships[0];

  return {
    ranch: {
      id: activeMembership.ranchId,
      name: activeMembership.ranchName,
      slug: activeMembership.ranchSlug,
      timeZone: resolveTimeZone(activeMembership.ranchTimeZone),
      onboardingCompleted: activeMembership.onboardingCompleted,
      subscriptionStatus: activeMembership.subscriptionStatus,
      subscriptionPlanKey: activeMembership.subscriptionPlanKey,
      stripeCustomerId: activeMembership.stripeCustomerId,
      stripeSubscriptionId: activeMembership.stripeSubscriptionId,
      subscriptionCurrentPeriodEnd: activeMembership.subscriptionCurrentPeriodEnd,
      betaLifetimeAccess: activeMembership.betaLifetimeAccess,
      allowPlatformAdminAccess: activeMembership.allowPlatformAdminAccess,
    },
    membership: {
      id: activeMembership.membershipId,
      role: activeMembership.role,
      capabilityOverrides:
        (activeMembership.capabilityOverrides as MembershipCapabilityOverrides) ?? {},
      sectionAccess: resolveSectionAccess(
        activeMembership.role,
        activeMembership.capabilityOverrides,
      ),
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

  return getRanchContextForUser(
    user.id,
    user.lastActiveRanchId,
    isPlatformAdminEmail(user.email),
  );
});

export async function getPostAuthRedirectPath(user: AuthUser): Promise<string> {
  if (user.mustResetPassword) {
    return "/reset-password";
  }

  const isPlatformAdmin = isPlatformAdminEmail(user.email);
  const ranchContext = await getRanchContextForUser(
    user.id,
    user.lastActiveRanchId,
    isPlatformAdmin,
  );
  if (!ranchContext || !ranchContext.ranch.onboardingCompleted) {
    return isPlatformAdmin ? "/admin" : "/onboarding";
  }

  if (!hasBillingAccess(ranchContext.ranch)) {
    return "/app/billing-required";
  }

  return resolvePreferredAppPath(ranchContext.membership.sectionAccess);
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
  const isPlatformAdmin = isPlatformAdminEmail(user.email);
  if (user.mustResetPassword) {
    redirect("/reset-password");
  }

  const ranchContext = await getRanchContextForUser(
    user.id,
    user.lastActiveRanchId,
    isPlatformAdmin,
  );

  if (!ranchContext || !ranchContext.ranch.onboardingCompleted) {
    redirect(isPlatformAdmin ? "/admin" : "/onboarding");
  }

  return {
    user: {
      ...user,
      timeZone: ranchContext.ranch.timeZone,
    },
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

export async function requireSectionAccess(
  section: AppSection,
  required: SectionAccessLevel = "view",
  options?: { requirePaid?: boolean },
): Promise<AppContext> {
  const context =
    options?.requirePaid === false
      ? await requireAppContext()
      : await requirePaidAccessContext();

  if (!hasSectionAccess(context.membership.sectionAccess, section, required)) {
    redirect("/app/access-denied");
  }

  return context;
}

export async function requireSectionManage(
  section: AppSection,
  options?: { requirePaid?: boolean },
): Promise<AppContext> {
  return requireSectionAccess(section, "manage", options);
}

export function roleCanManageOperations(role: RanchRole): boolean {
  return role === "owner" || role === "manager";
}
