import { and, asc, eq } from "drizzle-orm";
import {
  resolveSectionAccess,
  type MembershipCapabilityOverrides,
  type SectionAccessMap,
} from "@/lib/auth/capabilities";
import { isPlatformAdminEmail } from "@/lib/auth/platform-admin";
import { db } from "@/lib/db/client";
import { ranchMemberships, users } from "@/lib/db/schema";

export interface TeamMemberRow {
  membershipId: string;
  userId: string;
  fullName: string;
  email: string;
  role: "owner" | "manager" | "worker" | "seasonal_worker";
  capabilityOverrides: MembershipCapabilityOverrides;
  sectionAccess: SectionAccessMap;
  payType: "hourly" | "salary" | "piece_work";
  payRateCents: number;
  payAdvanceCents: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function getTeamMembersForRanch(
  ranchId: string,
  status: "active" | "inactive" | "all" = "active",
): Promise<TeamMemberRow[]> {
  const whereClause =
    status === "all"
      ? eq(ranchMemberships.ranchId, ranchId)
      : and(
          eq(ranchMemberships.ranchId, ranchId),
          eq(ranchMemberships.isActive, status === "active"),
        );

  const rows = await db
    .select({
      membershipId: ranchMemberships.id,
      userId: users.id,
      fullName: users.fullName,
      email: users.email,
      role: ranchMemberships.role,
      capabilityOverrides: ranchMemberships.capabilityOverrides,
      payType: ranchMemberships.payType,
      payRateCents: ranchMemberships.payRateCents,
      payAdvanceCents: ranchMemberships.payAdvanceCents,
      isActive: ranchMemberships.isActive,
      createdAt: ranchMemberships.createdAt,
      updatedAt: ranchMemberships.updatedAt,
    })
    .from(ranchMemberships)
    .innerJoin(users, eq(ranchMemberships.userId, users.id))
    .where(whereClause)
    .orderBy(asc(users.fullName));

  return rows
    .filter((row) => !isPlatformAdminEmail(row.email))
    .map((row) => ({
      ...row,
      capabilityOverrides:
        (row.capabilityOverrides as MembershipCapabilityOverrides) ?? {},
      sectionAccess: resolveSectionAccess(row.role, row.capabilityOverrides),
    }));
}

export async function getTeamMemberByMembership(
  ranchId: string,
  membershipId: string,
): Promise<TeamMemberRow | null> {
  const [row] = await db
    .select({
      membershipId: ranchMemberships.id,
      userId: users.id,
      fullName: users.fullName,
      email: users.email,
      role: ranchMemberships.role,
      capabilityOverrides: ranchMemberships.capabilityOverrides,
      payType: ranchMemberships.payType,
      payRateCents: ranchMemberships.payRateCents,
      payAdvanceCents: ranchMemberships.payAdvanceCents,
      isActive: ranchMemberships.isActive,
      createdAt: ranchMemberships.createdAt,
      updatedAt: ranchMemberships.updatedAt,
    })
    .from(ranchMemberships)
    .innerJoin(users, eq(ranchMemberships.userId, users.id))
    .where(
      and(
        eq(ranchMemberships.ranchId, ranchId),
        eq(ranchMemberships.id, membershipId),
      ),
    )
    .limit(1);

  if (!row || isPlatformAdminEmail(row.email)) {
    return null;
  }

  return {
    ...row,
    capabilityOverrides:
      (row.capabilityOverrides as MembershipCapabilityOverrides) ?? {},
    sectionAccess: resolveSectionAccess(row.role, row.capabilityOverrides),
  };
}
