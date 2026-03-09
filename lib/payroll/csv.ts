import type { PayrollSummaryRow } from "./queries";

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function buildPayrollCsv(rows: PayrollSummaryRow[]): string {
  const header = [
    "Name",
    "Email",
    "Role",
    "Pay Type",
    "Pay Rate",
    "Hours",
    "Estimated Pay",
    "Member Status",
  ];

  const lines = rows.map((row) =>
    [
      row.fullName,
      row.email,
      row.role,
      row.payType,
      centsToDollars(row.payRateCents),
      row.hoursWorked.toFixed(2),
      centsToDollars(row.estimatedPayCents),
      row.isActive ? "active" : "inactive",
    ]
      .map((value) => escapeCsv(String(value)))
      .join(","),
  );

  return [header.join(","), ...lines].join("\n");
}
