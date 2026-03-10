import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  payrollPeriodAdvances,
  payrollPeriodMemberReceipts,
  payrollPeriods,
  ranchMemberships,
  users,
  type PayrollPeriodStatus,
} from "@/lib/db/schema";
import { resolvePayrollDateRange } from "@/lib/payroll/date-range";
import { getPayrollSummaryForRange } from "@/lib/payroll/queries";

export interface PayrollPeriodRecord {
  id: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: PayrollPeriodStatus;
  paidAt: Date | null;
}

export interface PayrollPeriodLedgerRow {
  membershipId: string;
  fullName: string;
  payType: "hourly" | "salary" | "piece_work";
  payRateCents: number;
  isActive: boolean;
  grossPayCents: number;
  carryInPayableCents: number;
  carryInAdvanceCents: number;
  periodAdvanceCents: number;
  advanceAppliedCents: number;
  advanceRemainingCents: number;
  netPayableCents: number;
  willCarryToNextCents: number;
  isCheckPickedUp: boolean;
}

export interface PayrollPeriodAdvanceEntry {
  id: string;
  membershipId: string;
  fullName: string;
  amountCents: number;
  note: string | null;
  createdAt: Date;
}

export interface PayrollPeriodLedgerTotals {
  totalGrossPayCents: number;
  totalCarryInPayableCents: number;
  totalCarryInAdvanceCents: number;
  totalPeriodAdvanceCents: number;
  totalAdvanceAppliedCents: number;
  totalAdvanceRemainingCents: number;
  totalNetPayableCents: number;
  totalWillCarryToNextCents: number;
}

export interface PayrollPeriodWorkspace {
  periods: PayrollPeriodRecord[];
  selectedPeriod: PayrollPeriodRecord | null;
  ledgerRows: PayrollPeriodLedgerRow[];
  totals: PayrollPeriodLedgerTotals;
  selectedPeriodAdvances: PayrollPeriodAdvanceEntry[];
  memberOptions: { membershipId: string; fullName: string }[];
}

const emptyTotals: PayrollPeriodLedgerTotals = {
  totalGrossPayCents: 0,
  totalCarryInPayableCents: 0,
  totalCarryInAdvanceCents: 0,
  totalPeriodAdvanceCents: 0,
  totalAdvanceAppliedCents: 0,
  totalAdvanceRemainingCents: 0,
  totalNetPayableCents: 0,
  totalWillCarryToNextCents: 0,
};

function toDateOnlyString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function chooseSelectedPeriod(
  periodsAsc: PayrollPeriodRecord[],
  selectedPeriodId?: string,
): PayrollPeriodRecord | null {
  if (!periodsAsc.length) {
    return null;
  }

  if (selectedPeriodId) {
    const byId = periodsAsc.find((period) => period.id === selectedPeriodId);
    if (byId) {
      return byId;
    }
  }

  const today = toDateOnlyString(startOfTodayUtc());
  const current = periodsAsc.find(
    (period) => period.periodStart <= today && period.periodEnd >= today,
  );
  if (current) {
    return current;
  }

  return periodsAsc[periodsAsc.length - 1];
}

export async function getPayrollPeriodWorkspace(
  ranchId: string,
  selectedPeriodId?: string,
): Promise<PayrollPeriodWorkspace> {
  const periodRowsAsc = await db
    .select({
      id: payrollPeriods.id,
      periodStart: payrollPeriods.periodStart,
      periodEnd: payrollPeriods.periodEnd,
      payDate: payrollPeriods.payDate,
      status: payrollPeriods.status,
      paidAt: payrollPeriods.paidAt,
    })
    .from(payrollPeriods)
    .where(eq(payrollPeriods.ranchId, ranchId))
    .orderBy(asc(payrollPeriods.periodStart));

  const periodsDesc = [...periodRowsAsc].reverse();
  const selectedPeriod = chooseSelectedPeriod(periodRowsAsc, selectedPeriodId);

  const membershipRows = await db
    .select({
      membershipId: ranchMemberships.id,
      fullName: users.fullName,
      payType: ranchMemberships.payType,
      payRateCents: ranchMemberships.payRateCents,
      isActive: ranchMemberships.isActive,
      payAdvanceCents: ranchMemberships.payAdvanceCents,
    })
    .from(ranchMemberships)
    .innerJoin(users, eq(ranchMemberships.userId, users.id))
    .where(eq(ranchMemberships.ranchId, ranchId))
    .orderBy(asc(users.fullName));

  const memberOptions = membershipRows
    .filter((member) => member.isActive)
    .map((member) => ({
      membershipId: member.membershipId,
      fullName: member.fullName,
    }));

  if (!selectedPeriod) {
    return {
      periods: periodsDesc,
      selectedPeriod: null,
      ledgerRows: [],
      totals: emptyTotals,
      selectedPeriodAdvances: [],
      memberOptions,
    };
  }

  const selectedPeriodIndex = periodRowsAsc.findIndex((period) => period.id === selectedPeriod.id);
  const periodsUpToSelected = periodRowsAsc.slice(0, selectedPeriodIndex + 1);
  const periodIds = periodsUpToSelected.map((period) => period.id);

  const advanceRows =
    periodIds.length > 0
      ? await db
          .select({
            periodId: payrollPeriodAdvances.periodId,
            membershipId: payrollPeriodAdvances.membershipId,
            amountCents: payrollPeriodAdvances.amountCents,
          })
          .from(payrollPeriodAdvances)
          .where(
            and(
              eq(payrollPeriodAdvances.ranchId, ranchId),
              inArray(payrollPeriodAdvances.periodId, periodIds),
            ),
          )
      : [];

  const receiptRows =
    periodIds.length > 0
      ? await db
          .select({
            periodId: payrollPeriodMemberReceipts.periodId,
            membershipId: payrollPeriodMemberReceipts.membershipId,
            isCheckPickedUp: payrollPeriodMemberReceipts.isCheckPickedUp,
          })
          .from(payrollPeriodMemberReceipts)
          .where(
            and(
              eq(payrollPeriodMemberReceipts.ranchId, ranchId),
              inArray(payrollPeriodMemberReceipts.periodId, periodIds),
            ),
          )
      : [];

  const advancesByPeriodAndMember = new Map<string, Map<string, number>>();
  for (const row of advanceRows) {
    const byMember = advancesByPeriodAndMember.get(row.periodId) ?? new Map<string, number>();
    byMember.set(row.membershipId, (byMember.get(row.membershipId) ?? 0) + row.amountCents);
    advancesByPeriodAndMember.set(row.periodId, byMember);
  }

  const receiptsByPeriodAndMember = new Map<string, Map<string, boolean>>();
  for (const row of receiptRows) {
    const byMember = receiptsByPeriodAndMember.get(row.periodId) ?? new Map<string, boolean>();
    byMember.set(row.membershipId, row.isCheckPickedUp);
    receiptsByPeriodAndMember.set(row.periodId, byMember);
  }

  const summaryByPeriod = new Map<string, Map<string, number>>();
  const summaries = await Promise.all(
    periodsUpToSelected.map(async (period) => {
      const range = resolvePayrollDateRange(period.periodStart, period.periodEnd);
      const summary = await getPayrollSummaryForRange(
        ranchId,
        range.fromDate,
        range.toDateExclusive,
      );
      return {
        periodId: period.id,
        grossByMembership: new Map(
          summary.rows.map((row) => [row.membershipId, row.grossPayCents]),
        ),
      };
    }),
  );
  for (const summary of summaries) {
    summaryByPeriod.set(summary.periodId, summary.grossByMembership);
  }

  const carryAdvanceByMembership = new Map<string, number>();
  const carryPayableByMembership = new Map<string, number>();
  for (const member of membershipRows) {
    carryAdvanceByMembership.set(member.membershipId, member.payAdvanceCents);
    carryPayableByMembership.set(member.membershipId, 0);
  }

  const selectedRows: PayrollPeriodLedgerRow[] = [];
  for (const period of periodsUpToSelected) {
    const grossByMembership = summaryByPeriod.get(period.id) ?? new Map<string, number>();
    const advancesByMember = advancesByPeriodAndMember.get(period.id) ?? new Map<string, number>();
    const receiptsByMember = receiptsByPeriodAndMember.get(period.id) ?? new Map<string, boolean>();

    for (const member of membershipRows) {
      const carryInAdvanceCents = carryAdvanceByMembership.get(member.membershipId) ?? 0;
      const carryInPayableCents = carryPayableByMembership.get(member.membershipId) ?? 0;
      const periodAdvanceCents = advancesByMember.get(member.membershipId) ?? 0;
      const grossPayCents = grossByMembership.get(member.membershipId) ?? 0;

      const totalAdvanceDebtCents = carryInAdvanceCents + periodAdvanceCents;
      const availableCents = Math.max(carryInPayableCents + grossPayCents, 0);
      const advanceAppliedCents = Math.min(totalAdvanceDebtCents, availableCents);
      const netPayableCents = availableCents - advanceAppliedCents;
      const advanceRemainingCents = totalAdvanceDebtCents - advanceAppliedCents;
      const isCheckPickedUp =
        period.status === "paid"
          ? (receiptsByMember.get(member.membershipId) ?? false)
          : false;
      const willCarryToNextCents =
        period.status === "paid" && isCheckPickedUp ? 0 : netPayableCents;

      carryAdvanceByMembership.set(member.membershipId, advanceRemainingCents);
      carryPayableByMembership.set(member.membershipId, willCarryToNextCents);

      if (period.id === selectedPeriod.id) {
        selectedRows.push({
          membershipId: member.membershipId,
          fullName: member.fullName,
          payType: member.payType,
          payRateCents: member.payRateCents,
          isActive: member.isActive,
          grossPayCents,
          carryInPayableCents,
          carryInAdvanceCents,
          periodAdvanceCents,
          advanceAppliedCents,
          advanceRemainingCents,
          netPayableCents,
          willCarryToNextCents,
          isCheckPickedUp,
        });
      }
    }
  }

  const visibleRows = selectedRows
    .filter(
      (row) =>
        row.isActive ||
        row.grossPayCents > 0 ||
        row.carryInPayableCents > 0 ||
        row.carryInAdvanceCents > 0 ||
        row.periodAdvanceCents > 0 ||
        row.advanceRemainingCents > 0 ||
        row.netPayableCents > 0,
    )
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  const totals = visibleRows.reduce<PayrollPeriodLedgerTotals>(
    (acc, row) => ({
      totalGrossPayCents: acc.totalGrossPayCents + row.grossPayCents,
      totalCarryInPayableCents: acc.totalCarryInPayableCents + row.carryInPayableCents,
      totalCarryInAdvanceCents: acc.totalCarryInAdvanceCents + row.carryInAdvanceCents,
      totalPeriodAdvanceCents: acc.totalPeriodAdvanceCents + row.periodAdvanceCents,
      totalAdvanceAppliedCents: acc.totalAdvanceAppliedCents + row.advanceAppliedCents,
      totalAdvanceRemainingCents:
        acc.totalAdvanceRemainingCents + row.advanceRemainingCents,
      totalNetPayableCents: acc.totalNetPayableCents + row.netPayableCents,
      totalWillCarryToNextCents: acc.totalWillCarryToNextCents + row.willCarryToNextCents,
    }),
    emptyTotals,
  );

  const selectedPeriodAdvances = await db
    .select({
      id: payrollPeriodAdvances.id,
      membershipId: payrollPeriodAdvances.membershipId,
      fullName: users.fullName,
      amountCents: payrollPeriodAdvances.amountCents,
      note: payrollPeriodAdvances.note,
      createdAt: payrollPeriodAdvances.createdAt,
    })
    .from(payrollPeriodAdvances)
    .innerJoin(
      ranchMemberships,
      eq(payrollPeriodAdvances.membershipId, ranchMemberships.id),
    )
    .innerJoin(users, eq(ranchMemberships.userId, users.id))
    .where(
      and(
        eq(payrollPeriodAdvances.ranchId, ranchId),
        eq(payrollPeriodAdvances.periodId, selectedPeriod.id),
      ),
    )
    .orderBy(desc(payrollPeriodAdvances.createdAt));

  return {
    periods: periodsDesc,
    selectedPeriod,
    ledgerRows: visibleRows,
    totals,
    selectedPeriodAdvances,
    memberOptions,
  };
}
