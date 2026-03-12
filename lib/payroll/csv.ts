import type {
  PayrollBreakdown,
  PayrollSummaryRow,
} from "./queries";
import { resolveTimeZone } from "@/lib/timezone";

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function formatDateTimeCsv(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(value);
}

function formatRole(role: "owner" | "manager" | "worker" | "seasonal_worker"): string {
  if (role === "worker") return "regular worker";
  if (role === "seasonal_worker") return "seasonal worker";
  return role;
}

function formatPayType(payType: "hourly" | "salary" | "piece_work"): string {
  if (payType === "piece_work") return "piece work";
  return payType;
}

export function buildPayrollCsv(rows: PayrollSummaryRow[]): string {
  const header = [
    "Name",
    "Email",
    "Role",
    "Pay Type",
    "Pay Rate",
    "Hours",
    "Base Pay",
    "Incentive Pay",
    "Advances",
    "Final Check",
    "Total Pay",
    "Member Status",
  ];

  const lines = rows.map((row) =>
    [
      row.fullName,
      row.email,
      formatRole(row.role),
      formatPayType(row.payType),
      centsToDollars(row.payRateCents),
      row.hoursWorked.toFixed(2),
      centsToDollars(row.basePayCents),
      centsToDollars(row.incentivePayCents),
      centsToDollars(row.payAdvanceCents),
      centsToDollars(row.totalPayCents - row.payAdvanceCents),
      centsToDollars(row.totalPayCents),
      row.isActive ? "active" : "inactive",
    ]
      .map((value) => escapeCsv(String(value)))
      .join(","),
  );

  return [header.join(","), ...lines].join("\n");
}

export function buildPayrollBreakdownCsv(
  data: PayrollBreakdown,
  requestedTimeZone?: string,
): string {
  const timeZone = resolveTimeZone(requestedTimeZone);
  const intervalCount = Math.max(1, data.maxIntervalsPerDay);
  const intervalHeaders: string[] = [];
  for (let index = 0; index < intervalCount; index += 1) {
    intervalHeaders.push(
      `In ${index + 1} (${timeZone})`,
      `Out ${index + 1} (${timeZone})`,
    );
  }

  const header = [
    "Worker",
    "Date (UTC)",
    ...intervalHeaders,
    "Total Worked (hrs)",
    "Pay Type",
    "Pay Rate",
    "Base Pay For Row",
    "Incentive For Row",
    "Pay Calculation",
    "Total Pay For Row",
  ];

  const dayRowsByMembership = new Map<string, (typeof data.dayRows)[number][]>();
  for (const row of data.dayRows) {
    const current = dayRowsByMembership.get(row.membershipId) ?? [];
    current.push(row);
    dayRowsByMembership.set(row.membershipId, current);
  }

  const lines: string[] = [header.join(",")];

  for (const workerTotal of data.workerTotals) {
    const dayRows = (dayRowsByMembership.get(workerTotal.membershipId) ?? []).sort((a, b) =>
      a.workDate.localeCompare(b.workDate),
    );

    for (const dayRow of dayRows) {
      const values: string[] = [workerTotal.fullName, dayRow.workDate];

      for (let index = 0; index < intervalCount; index += 1) {
        const interval = dayRow.intervals[index];
        values.push(
          interval ? formatDateTimeCsv(interval.inAt, timeZone) : "",
          interval ? formatDateTimeCsv(interval.outAt, timeZone) : "",
        );
      }

      const dailyPayCents =
        workerTotal.payType === "hourly"
          ? Math.round(dayRow.totalWorkedHours * workerTotal.payRateCents)
          : 0;
      const payCalculation =
        workerTotal.payType === "hourly"
          ? `${dayRow.totalWorkedHours.toFixed(2)} x ${centsToDollars(workerTotal.payRateCents)}`
          : workerTotal.payType === "piece_work"
            ? "work-order timer hours"
            : "salary period amount";

      values.push(
        dayRow.totalWorkedHours.toFixed(2),
        formatPayType(workerTotal.payType),
        centsToDollars(workerTotal.payRateCents),
        dailyPayCents > 0 ? centsToDollars(dailyPayCents) : "",
        "",
        payCalculation,
        dailyPayCents > 0 ? centsToDollars(dailyPayCents) : "",
      );

      lines.push(values.map((value) => escapeCsv(value)).join(","));
    }

    const totalValues: string[] = [
      `${workerTotal.fullName} TOTAL`,
      "PAY PERIOD TOTAL",
    ];
    for (let index = 0; index < intervalCount; index += 1) {
      totalValues.push("", "");
    }

    const totalCalculation =
      workerTotal.payType === "hourly"
        ? `${workerTotal.totalWorkedHours.toFixed(2)} x ${centsToDollars(workerTotal.payRateCents)}`
        : workerTotal.payType === "piece_work"
          ? `${workerTotal.paidHours.toFixed(2)} x ${centsToDollars(workerTotal.payRateCents)}`
          : "salary period amount";

    totalValues.push(
      workerTotal.totalWorkedHours.toFixed(2),
      formatPayType(workerTotal.payType),
      centsToDollars(workerTotal.payRateCents),
      centsToDollars(workerTotal.basePayCents),
      centsToDollars(workerTotal.incentivePayCents),
      totalCalculation,
      centsToDollars(workerTotal.totalPayCents),
    );

    lines.push(totalValues.map((value) => escapeCsv(value)).join(","));
    lines.push("");
  }

  return lines.join("\n");
}
