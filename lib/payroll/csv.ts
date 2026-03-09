import type {
  PayrollBreakdown,
  PayrollSummaryRow,
} from "./queries";

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function formatDateTimeCsv(value: Date): string {
  return value.toISOString();
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
    "Gross Pay",
    "Pay Advance",
    "Net Pay",
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
      centsToDollars(row.grossPayCents),
      centsToDollars(row.payAdvanceCents),
      centsToDollars(row.totalPayCents),
      row.isActive ? "active" : "inactive",
    ]
      .map((value) => escapeCsv(String(value)))
      .join(","),
  );

  return [header.join(","), ...lines].join("\n");
}

export function buildPayrollBreakdownCsv(data: PayrollBreakdown): string {
  const intervalCount = Math.max(1, data.maxIntervalsPerDay);
  const intervalHeaders: string[] = [];
  for (let index = 0; index < intervalCount; index += 1) {
    intervalHeaders.push(`In ${index + 1} (UTC)`, `Out ${index + 1} (UTC)`);
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
    "Advance Deduction",
    "Pay Calculation",
    "Net Pay For Row",
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
          interval ? formatDateTimeCsv(interval.inAt).slice(11, 16) : "",
          interval ? formatDateTimeCsv(interval.outAt).slice(11, 16) : "",
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
      centsToDollars(workerTotal.payAdvanceCents),
      totalCalculation,
      centsToDollars(workerTotal.totalPayCents),
    );

    lines.push(totalValues.map((value) => escapeCsv(value)).join(","));
    lines.push("");
  }

  return lines.join("\n");
}
