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
    "Estimated Pay",
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
      centsToDollars(row.estimatedPayCents),
      row.isActive ? "active" : "inactive",
    ]
      .map((value) => escapeCsv(String(value)))
      .join(","),
  );

  return [header.join(","), ...lines].join("\n");
}
