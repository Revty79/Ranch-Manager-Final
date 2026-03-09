import { and, eq, gt, isNull, lt, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { ranchMemberships, shifts, users } from "@/lib/db/schema";

export interface PayrollSummaryRow {
  membershipId: string;
  fullName: string;
  email: string;
  role: "owner" | "manager" | "worker" | "Seasonal";
  payType: "hourly" | "salary" | "piecework";
  payRateCents: number;
  hoursWorked: number;
  estimatedPayCents: number;
  isActive: boolean;
}

export interface PayrollSummary {
  rows: PayrollSummaryRow[];
  totalHours: number;
  totalEstimatedPayCents: number;
}

function secondsBetween(start: Date, end: Date): number {
  return Math.max((end.getTime() - start.getTime()) / 1000, 0);
}

export async function getPayrollSummaryForRange(
  ranchId: string,
  fromDate: Date,
  toDateExclusive: Date,
): Promise<PayrollSummary> {
  const [memberRows, shiftRows] = await Promise.all([
    db
      .select({
        membershipId: ranchMemberships.id,
        fullName: users.fullName,
        email: users.email,
        role: ranchMemberships.role,
        payType: ranchMemberships.payType,
        payRateCents: ranchMemberships.payRateCents,
        isActive: ranchMemberships.isActive,
      })
      .from(ranchMemberships)
      .innerJoin(users, eq(ranchMemberships.userId, users.id))
      .where(eq(ranchMemberships.ranchId, ranchId)),
    db
      .select({
        membershipId: shifts.membershipId,
        startedAt: shifts.startedAt,
        endedAt: shifts.endedAt,
      })
      .from(shifts)
      .where(
        and(
          eq(shifts.ranchId, ranchId),
          lt(shifts.startedAt, toDateExclusive),
          or(isNull(shifts.endedAt), gt(shifts.endedAt, fromDate)),
        ),
      ),
  ]);

  const secondsByMembership = new Map<string, number>();

  for (const shift of shiftRows) {
    const boundedStart = shift.startedAt > fromDate ? shift.startedAt : fromDate;
    const endedAt = shift.endedAt ?? new Date();
    const boundedEnd = endedAt < toDateExclusive ? endedAt : toDateExclusive;

    if (boundedEnd > boundedStart) {
      const current = secondsByMembership.get(shift.membershipId) ?? 0;
      secondsByMembership.set(
        shift.membershipId,
        current + secondsBetween(boundedStart, boundedEnd),
      );
    }
  }

  const rows: PayrollSummaryRow[] = memberRows
    .filter((member) => member.isActive || (secondsByMembership.get(member.membershipId) ?? 0) > 0)
    .map((member) => {
      const seconds = secondsByMembership.get(member.membershipId) ?? 0;
      const hoursWorked = Number((seconds / 3600).toFixed(2));
      const estimatedPayCents =
        member.payType === "hourly"
          ? Math.round(hoursWorked * member.payRateCents)
          : member.isActive
            ? member.payRateCents
            : 0;

      return {
        membershipId: member.membershipId,
        fullName: member.fullName,
        email: member.email,
        role: member.role,
        payType: member.payType,
        payRateCents: member.payRateCents,
        hoursWorked,
        estimatedPayCents,
        isActive: member.isActive,
      };
    });

  const totalHours = Number(
    rows.reduce((sum, row) => sum + row.hoursWorked, 0).toFixed(2),
  );
  const totalEstimatedPayCents = rows.reduce(
    (sum, row) => sum + row.estimatedPayCents,
    0,
  );

  return {
    rows,
    totalHours,
    totalEstimatedPayCents,
  };
}
