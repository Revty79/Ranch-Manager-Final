import { and, eq, gt, gte, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  ranchMemberships,
  shifts,
  users,
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

function isMissingIncentiveSchemaError(error: unknown): boolean {
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
      text.includes("incentive_pay_cents"))
  );
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

async function getIncentivePayByMembershipForRange(
  ranchId: string,
  fromDate: Date,
  toDateExclusive: Date,
): Promise<Map<string, number>> {
  const incentivePayByMembership = new Map<string, number>();
  let incentiveOrderRows: {
    workOrderId: string;
    incentivePayCents: number;
    completedAt: Date | null;
    incentiveEndsAt: Date | null;
  }[] = [];

  try {
    incentiveOrderRows = await db
      .select({
        workOrderId: workOrders.id,
        incentivePayCents: workOrders.incentivePayCents,
        completedAt: workOrders.completedAt,
        incentiveEndsAt: workOrders.incentiveEndsAt,
      })
      .from(workOrders)
      .where(
        and(
          eq(workOrders.ranchId, ranchId),
          eq(workOrders.status, "completed"),
          gt(workOrders.incentivePayCents, 0),
          isNotNull(workOrders.completedAt),
          gte(workOrders.completedAt, fromDate),
          lt(workOrders.completedAt, toDateExclusive),
        ),
      );
  } catch (error) {
    const issueType = isMissingIncentiveSchemaError(error)
      ? "schema-mismatch"
      : "query-failure";
    console.warn(
      `[payroll] incentive payout lookup skipped (${issueType}); continuing without incentives for this request.`,
    );
    return incentivePayByMembership;
  }

  const incentiveEligibleOrders = incentiveOrderRows
    .filter(
      (row) =>
        row.completedAt !== null &&
        row.incentiveEndsAt !== null &&
        row.completedAt <= row.incentiveEndsAt,
    )
    .map((row) => ({
      workOrderId: row.workOrderId,
      incentivePayCents: row.incentivePayCents,
    }));

  if (!incentiveEligibleOrders.length) {
    return incentivePayByMembership;
  }

  const orderIds = incentiveEligibleOrders.map((row) => row.workOrderId);
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

  for (const order of incentiveEligibleOrders) {
    const timedParticipants = [
      ...(timedParticipantsByOrder.get(order.workOrderId) ?? new Set()),
    ];
    const participants =
      timedParticipants.length > 0
        ? timedParticipants.sort()
        : [...(assignedParticipantsByOrder.get(order.workOrderId) ?? new Set())].sort();

    if (!participants.length) {
      continue;
    }

    const splitCents = Math.floor(order.incentivePayCents / participants.length);
    const remainderCents = order.incentivePayCents - splitCents * participants.length;

    participants.forEach((membershipId, index) => {
      const bonus = splitCents + (index < remainderCents ? 1 : 0);
      const current = incentivePayByMembership.get(membershipId) ?? 0;
      incentivePayByMembership.set(membershipId, current + bonus);
    });
  }

  return incentivePayByMembership;
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

  const incentivePayByMembership = await getIncentivePayByMembershipForRange(
    ranchId,
    fromDate,
    toDateExclusive,
  );

  const rows: PayrollSummaryRow[] = memberRows
    .filter((member) => {
      const hasTrackedTime =
        (shiftSecondsByMembership.get(member.membershipId) ?? 0) > 0 ||
        (workSecondsByMembership.get(member.membershipId) ?? 0) > 0 ||
        (incentivePayByMembership.get(member.membershipId) ?? 0) > 0;
      return member.isActive || hasTrackedTime;
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
      const incentivePayCents = incentivePayByMembership.get(member.membershipId) ?? 0;
      const grossPayCents = basePayCents + incentivePayCents;
      const payAdvanceCents = 0;
      const totalPayCents = grossPayCents - payAdvanceCents;

      return {
        membershipId: member.membershipId,
        fullName: member.fullName,
        email: member.email,
        role: member.role,
        payType: member.payType,
        payRateCents: member.payRateCents,
        hoursWorked,
        basePayCents,
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

  const memberById = new Map(memberRows.map((row) => [row.membershipId, row]));
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
      const incentivePayCents = summaryRow?.incentivePayCents ?? 0;
      const grossPayCents = summaryRow?.grossPayCents ?? basePayCents + incentivePayCents;
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
