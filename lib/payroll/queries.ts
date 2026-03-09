import { and, eq, gt, isNull, lt, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { ranchMemberships, shifts, users, workTimeEntries } from "@/lib/db/schema";

export interface PayrollSummaryRow {
  membershipId: string;
  fullName: string;
  email: string;
  role: "owner" | "manager" | "worker" | "seasonal_worker";
  payType: "hourly" | "salary" | "piece_work";
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
  const [memberRows, shiftRows, workRows] = await Promise.all([
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
    db
      .select({
        membershipId: workTimeEntries.membershipId,
        startedAt: workTimeEntries.startedAt,
        endedAt: workTimeEntries.endedAt,
      })
      .from(workTimeEntries)
      .where(
        and(
          eq(workTimeEntries.ranchId, ranchId),
          lt(workTimeEntries.startedAt, toDateExclusive),
          or(isNull(workTimeEntries.endedAt), gt(workTimeEntries.endedAt, fromDate)),
        ),
      ),
  ]);

  const shiftSecondsByMembership = new Map<string, number>();
  const workSecondsByMembership = new Map<string, number>();

  for (const shift of shiftRows) {
    const boundedStart = shift.startedAt > fromDate ? shift.startedAt : fromDate;
    const endedAt = shift.endedAt ?? new Date();
    const boundedEnd = endedAt < toDateExclusive ? endedAt : toDateExclusive;

    if (boundedEnd > boundedStart) {
      const current = shiftSecondsByMembership.get(shift.membershipId) ?? 0;
      shiftSecondsByMembership.set(
        shift.membershipId,
        current + secondsBetween(boundedStart, boundedEnd),
      );
    }
  }

  for (const entry of workRows) {
    const boundedStart = entry.startedAt > fromDate ? entry.startedAt : fromDate;
    const endedAt = entry.endedAt ?? new Date();
    const boundedEnd = endedAt < toDateExclusive ? endedAt : toDateExclusive;

    if (boundedEnd > boundedStart) {
      const current = workSecondsByMembership.get(entry.membershipId) ?? 0;
      workSecondsByMembership.set(
        entry.membershipId,
        current + secondsBetween(boundedStart, boundedEnd),
      );
    }
  }

  const rows: PayrollSummaryRow[] = memberRows
    .filter((member) => {
      const hasTrackedTime =
        (shiftSecondsByMembership.get(member.membershipId) ?? 0) > 0 ||
        (workSecondsByMembership.get(member.membershipId) ?? 0) > 0;
      return member.isActive || hasTrackedTime;
    })
    .map((member) => {
      const shiftSeconds = shiftSecondsByMembership.get(member.membershipId) ?? 0;
      const workSeconds = workSecondsByMembership.get(member.membershipId) ?? 0;
      const paidSeconds = member.payType === "piece_work" ? workSeconds : shiftSeconds;
      const hoursWorked = Number((paidSeconds / 3600).toFixed(2));
      const estimatedPayCents =
        member.payType === "hourly" || member.payType === "piece_work"
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
