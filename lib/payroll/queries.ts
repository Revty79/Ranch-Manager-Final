import { and, eq, gt, gte, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";
import { isPlatformAdminEmail } from "@/lib/auth/platform-admin";
import { db } from "@/lib/db/client";
import {
  payrollPeriodAdvances,
  payrollPeriods,
  ranchMemberships,
  shifts,
  users,
  workOrderCompletionReviews,
  workOrderAssignments,
  workOrders,
  workTimeEntries,
} from "@/lib/db/schema";

export interface PayrollSummaryRow {
  membershipId: string;
  fullName: string;
  email: string;
  role: "owner" | "manager" | "worker" | "seasonal_worker";
  payType: "hourly" | "salary" | "piece_work";
  payRateCents: number;
  hoursWorked: number;
  basePayCents: number;
  flatWorkPayCents: number;
  incentivePayCents: number;
  grossPayCents: number;
  payAdvanceCents: number;
  totalPayCents: number;
  isActive: boolean;
}

export interface PayrollSummary {
  rows: PayrollSummaryRow[];
  totalHours: number;
  totalBasePayCents: number;
  totalFlatWorkPayCents: number;
  totalIncentivePayCents: number;
  totalGrossPayCents: number;
  totalPayAdvanceCents: number;
  totalPayCents: number;
}

export interface PayrollBreakdownInterval {
  inAt: Date;
  outAt: Date;
  workedHours: number;
}

export interface PayrollBreakdownDayRow {
  membershipId: string;
  fullName: string;
  email: string;
  role: "owner" | "manager" | "worker" | "seasonal_worker";
  payType: "hourly" | "salary" | "piece_work";
  payRateCents: number;
  workDate: string;
  intervals: PayrollBreakdownInterval[];
  totalWorkedHours: number;
}

export interface PayrollBreakdownWorkerTotalRow {
  membershipId: string;
  fullName: string;
  email: string;
  role: "owner" | "manager" | "worker" | "seasonal_worker";
  payType: "hourly" | "salary" | "piece_work";
  payRateCents: number;
  totalWorkedHours: number;
  paidHours: number;
  basePayCents: number;
  flatWorkPayCents: number;
  incentivePayCents: number;
  grossPayCents: number;
  payAdvanceCents: number;
  totalPayCents: number;
  isActive: boolean;
}

export interface PayrollBreakdown {
  dayRows: PayrollBreakdownDayRow[];
  workerTotals: PayrollBreakdownWorkerTotalRow[];
  maxIntervalsPerDay: number;
}

function secondsBetween(start: Date, end: Date): number {
  return Math.max((end.getTime() - start.getTime()) / 1000, 0);
}

function isMissingWorkOrderPaySchemaError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const asRecord = error as {
    message?: string;
    cause?: { code?: string; message?: string };
  };
  const errorCode = asRecord.cause?.code;
  const text = `${asRecord.message ?? ""} ${asRecord.cause?.message ?? ""}`.toLowerCase();

  if (errorCode === "42703") {
    return true;
  }

  return (
    text.includes("column") &&
    (text.includes("completed_at") ||
      text.includes("incentive_ends_at") ||
      text.includes("incentive_pay_cents") ||
      text.includes("flat_pay_cents") ||
      text.includes("compensation_type"))
  );
}

function distributeEvenly(
  totalCents: number,
  participants: string[],
  target: Map<string, number>,
) {
  if (totalCents <= 0 || participants.length === 0) {
    return;
  }

  const splitCents = Math.floor(totalCents / participants.length);
  const remainderCents = totalCents - splitCents * participants.length;

  participants.forEach((membershipId, index) => {
    const payout = splitCents + (index < remainderCents ? 1 : 0);
    const current = target.get(membershipId) ?? 0;
    target.set(membershipId, current + payout);
  });
}

function toUtcDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function startOfNextUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate() + 1,
      0,
      0,
      0,
      0,
    ),
  );
}

async function getCompletedWorkOrderPayByMembershipForRange(
  ranchId: string,
  fromDate: Date,
  toDateExclusive: Date,
): Promise<{
  flatWorkPayByMembership: Map<string, number>;
  incentivePayByMembership: Map<string, number>;
}> {
  const flatWorkPayByMembership = new Map<string, number>();
  const incentivePayByMembership = new Map<string, number>();
  let completedOrderRows: {
    workOrderId: string;
    compensationType: "standard" | "flat_amount";
    flatPayCents: number;
    incentivePayCents: number;
    completedAt: Date | null;
    incentiveEndsAt: Date | null;
    reviewStatus: "pending" | "approved" | "changes_requested" | null;
  }[] = [];

  try {
    completedOrderRows = await db
      .select({
        workOrderId: workOrders.id,
        compensationType: workOrders.compensationType,
        flatPayCents: workOrders.flatPayCents,
        incentivePayCents: workOrders.incentivePayCents,
        completedAt: workOrders.completedAt,
        incentiveEndsAt: workOrders.incentiveEndsAt,
        reviewStatus: workOrderCompletionReviews.status,
      })
      .from(workOrders)
      .leftJoin(
        workOrderCompletionReviews,
        eq(workOrderCompletionReviews.workOrderId, workOrders.id),
      )
      .where(
        and(
          eq(workOrders.ranchId, ranchId),
          eq(workOrders.status, "completed"),
          isNotNull(workOrders.completedAt),
          gte(workOrders.completedAt, fromDate),
          lt(workOrders.completedAt, toDateExclusive),
          or(gt(workOrders.flatPayCents, 0), gt(workOrders.incentivePayCents, 0)),
        ),
      );
  } catch (error) {
    const issueType = isMissingWorkOrderPaySchemaError(error)
      ? "schema-mismatch"
      : "query-failure";
    console.warn(
      `[payroll] completed work-order payout lookup skipped (${issueType}); continuing without work-order payouts for this request.`,
    );
    return {
      flatWorkPayByMembership,
      incentivePayByMembership,
    };
  }

  if (!completedOrderRows.length) {
    return {
      flatWorkPayByMembership,
      incentivePayByMembership,
    };
  }

  const orderIds = completedOrderRows.map((row) => row.workOrderId);
  const [timeParticipantRows, assignmentParticipantRows] = await Promise.all([
    db
      .select({
        workOrderId: workTimeEntries.workOrderId,
        membershipId: workTimeEntries.membershipId,
      })
      .from(workTimeEntries)
      .where(inArray(workTimeEntries.workOrderId, orderIds)),
    db
      .select({
        workOrderId: workOrderAssignments.workOrderId,
        membershipId: workOrderAssignments.membershipId,
      })
      .from(workOrderAssignments)
      .where(inArray(workOrderAssignments.workOrderId, orderIds)),
  ]);

  const timedParticipantsByOrder = new Map<string, Set<string>>();
  for (const row of timeParticipantRows) {
    const current = timedParticipantsByOrder.get(row.workOrderId) ?? new Set<string>();
    current.add(row.membershipId);
    timedParticipantsByOrder.set(row.workOrderId, current);
  }

  const assignedParticipantsByOrder = new Map<string, Set<string>>();
  for (const row of assignmentParticipantRows) {
    const current = assignedParticipantsByOrder.get(row.workOrderId) ?? new Set<string>();
    current.add(row.membershipId);
    assignedParticipantsByOrder.set(row.workOrderId, current);
  }

  for (const order of completedOrderRows) {
    if (order.reviewStatus !== null && order.reviewStatus !== "approved") {
      continue;
    }

    const timedParticipants = [...(timedParticipantsByOrder.get(order.workOrderId) ?? new Set())];
    const participants =
      timedParticipants.length > 0
        ? timedParticipants.sort()
        : [...(assignedParticipantsByOrder.get(order.workOrderId) ?? new Set())].sort();

    if (!participants.length) {
      continue;
    }

    if (order.compensationType === "flat_amount" && order.flatPayCents > 0) {
      distributeEvenly(order.flatPayCents, participants, flatWorkPayByMembership);
    }

    if (
      order.incentivePayCents > 0 &&
      order.completedAt !== null &&
      order.incentiveEndsAt !== null &&
      order.completedAt <= order.incentiveEndsAt
    ) {
      distributeEvenly(order.incentivePayCents, participants, incentivePayByMembership);
    }
  }

  return {
    flatWorkPayByMembership,
    incentivePayByMembership,
  };
}

export async function getPayrollSummaryForRange(
  ranchId: string,
  fromDate: Date,
  toDateExclusive: Date,
): Promise<PayrollSummary> {
  const fromDateKey = toUtcDateKey(fromDate);
  const toDateExclusiveKey = toUtcDateKey(toDateExclusive);

  const [memberRows, shiftRows, workRows, periodAdvanceRows] = await Promise.all([
    db
      .select({
        membershipId: ranchMemberships.id,
        fullName: users.fullName,
        email: users.email,
        role: ranchMemberships.role,
        payType: ranchMemberships.payType,
        payRateCents: ranchMemberships.payRateCents,
        payAdvanceCents: ranchMemberships.payAdvanceCents,
        isActive: ranchMemberships.isActive,
      })
      .from(ranchMemberships)
      .innerJoin(users, eq(ranchMemberships.userId, users.id))
      .where(eq(ranchMemberships.ranchId, ranchId)),
    db
      .select({
        membershipId: shifts.membershipId,
        startedAt: shifts.startedAt,
        pausedAt: shifts.pausedAt,
        pausedAccumulatedSeconds: shifts.pausedAccumulatedSeconds,
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
    db
      .select({
        membershipId: payrollPeriodAdvances.membershipId,
        amountCents: payrollPeriodAdvances.amountCents,
      })
      .from(payrollPeriodAdvances)
      .innerJoin(payrollPeriods, eq(payrollPeriodAdvances.periodId, payrollPeriods.id))
      .where(
        and(
          eq(payrollPeriodAdvances.ranchId, ranchId),
          lt(payrollPeriods.periodStart, toDateExclusiveKey),
          gte(payrollPeriods.periodEnd, fromDateKey),
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
      const baseSeconds = secondsBetween(boundedStart, boundedEnd);
      const activePauseStart =
        shift.pausedAt && shift.pausedAt > fromDate ? shift.pausedAt : fromDate;
      const activePauseSeconds =
        shift.pausedAt && boundedEnd > activePauseStart
          ? secondsBetween(activePauseStart, boundedEnd)
          : 0;
      const pausedSeconds = shift.pausedAccumulatedSeconds + activePauseSeconds;
      const paidSeconds = Math.max(baseSeconds - pausedSeconds, 0);
      const current = shiftSecondsByMembership.get(shift.membershipId) ?? 0;
      shiftSecondsByMembership.set(
        shift.membershipId,
        current + paidSeconds,
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

  const { flatWorkPayByMembership, incentivePayByMembership } =
    await getCompletedWorkOrderPayByMembershipForRange(
    ranchId,
    fromDate,
    toDateExclusive,
    );

  const visibleMemberRows = memberRows.filter(
    (member) => !isPlatformAdminEmail(member.email),
  );
  const periodAdvanceByMembership = new Map<string, number>();
  for (const advance of periodAdvanceRows) {
    const current = periodAdvanceByMembership.get(advance.membershipId) ?? 0;
    periodAdvanceByMembership.set(advance.membershipId, current + advance.amountCents);
  }

  const rows: PayrollSummaryRow[] = visibleMemberRows
    .filter((member) => {
      const hasTrackedTime =
        (shiftSecondsByMembership.get(member.membershipId) ?? 0) > 0 ||
        (workSecondsByMembership.get(member.membershipId) ?? 0) > 0 ||
        (flatWorkPayByMembership.get(member.membershipId) ?? 0) > 0 ||
        (incentivePayByMembership.get(member.membershipId) ?? 0) > 0;
      const hasAdvanceBalance =
        member.payAdvanceCents > 0 ||
        (periodAdvanceByMembership.get(member.membershipId) ?? 0) > 0;
      return member.isActive || hasTrackedTime || hasAdvanceBalance;
    })
    .map((member) => {
      const shiftSeconds = shiftSecondsByMembership.get(member.membershipId) ?? 0;
      const workSeconds = workSecondsByMembership.get(member.membershipId) ?? 0;
      const paidSeconds = member.payType === "piece_work" ? workSeconds : shiftSeconds;
      const hoursWorked = Number((paidSeconds / 3600).toFixed(2));
      const basePayCents =
        member.payType === "hourly" || member.payType === "piece_work"
          ? Math.round(hoursWorked * member.payRateCents)
          : member.isActive
            ? member.payRateCents
            : 0;
      const flatWorkPayCents = flatWorkPayByMembership.get(member.membershipId) ?? 0;
      const incentivePayCents = incentivePayByMembership.get(member.membershipId) ?? 0;
      const grossPayCents = basePayCents + flatWorkPayCents + incentivePayCents;
      const periodAdvanceCents = periodAdvanceByMembership.get(member.membershipId) ?? 0;
      const payAdvanceCents = member.payAdvanceCents + periodAdvanceCents;
      const totalPayCents = grossPayCents;

      return {
        membershipId: member.membershipId,
        fullName: member.fullName,
        email: member.email,
        role: member.role,
        payType: member.payType,
        payRateCents: member.payRateCents,
        hoursWorked,
        basePayCents,
        flatWorkPayCents,
        incentivePayCents,
        grossPayCents,
        payAdvanceCents,
        totalPayCents,
        isActive: member.isActive,
      };
    });

  const totalHours = Number(
    rows.reduce((sum, row) => sum + row.hoursWorked, 0).toFixed(2),
  );
  const totalBasePayCents = rows.reduce(
    (sum, row) => sum + row.basePayCents,
    0,
  );
  const totalFlatWorkPayCents = rows.reduce(
    (sum, row) => sum + row.flatWorkPayCents,
    0,
  );
  const totalIncentivePayCents = rows.reduce(
    (sum, row) => sum + row.incentivePayCents,
    0,
  );
  const totalGrossPayCents = rows.reduce(
    (sum, row) => sum + row.grossPayCents,
    0,
  );
  const totalPayAdvanceCents = rows.reduce(
    (sum, row) => sum + row.payAdvanceCents,
    0,
  );
  const totalPayCents = rows.reduce(
    (sum, row) => sum + row.totalPayCents,
    0,
  );

  return {
    rows,
    totalHours,
    totalBasePayCents,
    totalFlatWorkPayCents,
    totalIncentivePayCents,
    totalGrossPayCents,
    totalPayAdvanceCents,
    totalPayCents,
  };
}

export async function getPayrollBreakdownForRange(
  ranchId: string,
  fromDate: Date,
  toDateExclusive: Date,
): Promise<PayrollBreakdown> {
  const [memberRows, shiftRows, workRows, summary] = await Promise.all([
    db
      .select({
        membershipId: ranchMemberships.id,
        fullName: users.fullName,
        email: users.email,
        role: ranchMemberships.role,
        payType: ranchMemberships.payType,
        payRateCents: ranchMemberships.payRateCents,
        payAdvanceCents: ranchMemberships.payAdvanceCents,
        isActive: ranchMemberships.isActive,
      })
      .from(ranchMemberships)
      .innerJoin(users, eq(ranchMemberships.userId, users.id))
      .where(eq(ranchMemberships.ranchId, ranchId)),
    db
      .select({
        id: shifts.id,
        membershipId: shifts.membershipId,
        startedAt: shifts.startedAt,
        pausedAt: shifts.pausedAt,
        pausedAccumulatedSeconds: shifts.pausedAccumulatedSeconds,
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
        id: workTimeEntries.id,
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
    getPayrollSummaryForRange(ranchId, fromDate, toDateExclusive),
  ]);

  const visibleMemberRows = memberRows.filter(
    (member) => !isPlatformAdminEmail(member.email),
  );

  const memberById = new Map(visibleMemberRows.map((row) => [row.membershipId, row]));
  const summaryByMembership = new Map(summary.rows.map((row) => [row.membershipId, row]));
  const dayRowsMap = new Map<
    string,
    {
      membershipId: string;
      fullName: string;
      email: string;
      role: "owner" | "manager" | "worker" | "seasonal_worker";
      payType: "hourly" | "salary" | "piece_work";
      payRateCents: number;
      workDate: string;
      intervals: { inAt: Date; outAt: Date; workedSeconds: number }[];
      totalWorkedSeconds: number;
    }
  >();
  const dayTotalsByMembership = new Map<string, number>();

  for (const shift of shiftRows) {
    const member = memberById.get(shift.membershipId);
    if (!member || member.payType === "piece_work") {
      continue;
    }

    const boundedStart = shift.startedAt > fromDate ? shift.startedAt : fromDate;
    const endedAt = shift.endedAt ?? new Date();
    const boundedEnd = endedAt < toDateExclusive ? endedAt : toDateExclusive;

    if (boundedEnd <= boundedStart) {
      continue;
    }

    let cursor = boundedStart;
    while (cursor < boundedEnd) {
      const dayEnd = startOfNextUtcDay(cursor);
      const segmentEnd = dayEnd < boundedEnd ? dayEnd : boundedEnd;
      const workedSeconds = secondsBetween(cursor, segmentEnd);
      const workDate = toUtcDateKey(cursor);
      const key = `${member.membershipId}:${workDate}`;
      const dayRow =
        dayRowsMap.get(key) ??
        {
          membershipId: member.membershipId,
          fullName: member.fullName,
          email: member.email,
          role: member.role,
          payType: member.payType,
          payRateCents: member.payRateCents,
          workDate,
          intervals: [],
          totalWorkedSeconds: 0,
        };

      dayRow.intervals.push({
        inAt: cursor,
        outAt: segmentEnd,
        workedSeconds,
      });
      dayRow.totalWorkedSeconds += workedSeconds;
      dayRowsMap.set(key, dayRow);

      const dayTotalCurrent = dayTotalsByMembership.get(member.membershipId) ?? 0;
      dayTotalsByMembership.set(member.membershipId, dayTotalCurrent + workedSeconds);
      cursor = segmentEnd;
    }
  }

  for (const workEntry of workRows) {
    const member = memberById.get(workEntry.membershipId);
    if (!member || member.payType !== "piece_work") {
      continue;
    }

    const boundedStart = workEntry.startedAt > fromDate ? workEntry.startedAt : fromDate;
    const endedAt = workEntry.endedAt ?? new Date();
    const boundedEnd = endedAt < toDateExclusive ? endedAt : toDateExclusive;

    if (boundedEnd <= boundedStart) {
      continue;
    }

    let cursor = boundedStart;
    while (cursor < boundedEnd) {
      const dayEnd = startOfNextUtcDay(cursor);
      const segmentEnd = dayEnd < boundedEnd ? dayEnd : boundedEnd;
      const workedSeconds = secondsBetween(cursor, segmentEnd);
      const workDate = toUtcDateKey(cursor);
      const key = `${member.membershipId}:${workDate}`;
      const dayRow =
        dayRowsMap.get(key) ??
        {
          membershipId: member.membershipId,
          fullName: member.fullName,
          email: member.email,
          role: member.role,
          payType: member.payType,
          payRateCents: member.payRateCents,
          workDate,
          intervals: [],
          totalWorkedSeconds: 0,
        };

      dayRow.intervals.push({
        inAt: cursor,
        outAt: segmentEnd,
        workedSeconds,
      });
      dayRow.totalWorkedSeconds += workedSeconds;
      dayRowsMap.set(key, dayRow);

      const dayTotalCurrent = dayTotalsByMembership.get(member.membershipId) ?? 0;
      dayTotalsByMembership.set(member.membershipId, dayTotalCurrent + workedSeconds);
      cursor = segmentEnd;
    }
  }

  const dayRows: PayrollBreakdownDayRow[] = [...dayRowsMap.values()]
    .map((row) => ({
      membershipId: row.membershipId,
      fullName: row.fullName,
      email: row.email,
      role: row.role,
      payType: row.payType,
      payRateCents: row.payRateCents,
      workDate: row.workDate,
      intervals: row.intervals.map((interval) => ({
        inAt: interval.inAt,
        outAt: interval.outAt,
        workedHours: Number((interval.workedSeconds / 3600).toFixed(2)),
      })),
      totalWorkedHours: Number((row.totalWorkedSeconds / 3600).toFixed(2)),
    }))
    .sort((a, b) => {
      const byName = a.fullName.localeCompare(b.fullName);
      if (byName !== 0) {
        return byName;
      }
      return a.workDate.localeCompare(b.workDate);
    });

  const includedMemberships = new Set([
    ...dayRows.map((row) => row.membershipId),
    ...summary.rows
      .filter((row) => row.hoursWorked > 0 || row.totalPayCents !== 0)
      .map((row) => row.membershipId),
  ]);

  const workerTotals: PayrollBreakdownWorkerTotalRow[] = [...includedMemberships]
    .map((membershipId) => {
      const member = memberById.get(membershipId);
      if (!member) {
        return null;
      }

      const summaryRow = summaryByMembership.get(membershipId);
      const totalWorkedHours = Number(
        (((dayTotalsByMembership.get(membershipId) ?? 0) / 3600)).toFixed(2),
      );
      const paidHours = summaryRow?.hoursWorked ?? totalWorkedHours;
      const basePayCents =
        summaryRow?.basePayCents ??
        (member.payType === "hourly" || member.payType === "piece_work"
          ? Math.round(totalWorkedHours * member.payRateCents)
          : member.isActive
            ? member.payRateCents
            : 0);
      const flatWorkPayCents = summaryRow?.flatWorkPayCents ?? 0;
      const incentivePayCents = summaryRow?.incentivePayCents ?? 0;
      const grossPayCents =
        summaryRow?.grossPayCents ?? basePayCents + flatWorkPayCents + incentivePayCents;
      const payAdvanceCents = summaryRow?.payAdvanceCents ?? 0;
      const totalPayCents = grossPayCents - payAdvanceCents;

      return {
        membershipId: member.membershipId,
        fullName: member.fullName,
        email: member.email,
        role: member.role,
        payType: member.payType,
        payRateCents: member.payRateCents,
        totalWorkedHours,
        paidHours,
        basePayCents,
        flatWorkPayCents,
        incentivePayCents,
        grossPayCents,
        payAdvanceCents,
        totalPayCents,
        isActive: member.isActive,
      };
    })
    .filter((row): row is PayrollBreakdownWorkerTotalRow => row !== null)
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  const maxIntervalsPerDay = dayRows.reduce(
    (currentMax, row) => Math.max(currentMax, row.intervals.length),
    0,
  );

  return {
    dayRows,
    workerTotals,
    maxIntervalsPerDay,
  };
}
