import Link from "next/link";
import { Download } from "lucide-react";
import { EmptyState } from "@/components/patterns/empty-state";
import { PageHeader } from "@/components/patterns/page-header";
import { StatCard } from "@/components/patterns/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/auth/context";
import { resolvePayrollDateRange } from "@/lib/payroll/date-range";
import { getPayrollSummaryForRange } from "@/lib/payroll/queries";

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatRole(role: "owner" | "manager" | "worker" | "seasonal_worker"): string {
  if (role === "worker") return "Regular Worker";
  if (role === "seasonal_worker") return "Seasonal Worker";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function formatPayType(payType: "hourly" | "salary" | "piece_work"): string {
  if (payType === "piece_work") return "Piece Work";
  return payType.charAt(0).toUpperCase() + payType.slice(1);
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const context = await requireRole(["owner", "manager"]);
  const params = await searchParams;
  const range = resolvePayrollDateRange(params.from, params.to);
  const summary = await getPayrollSummaryForRange(
    context.ranch.id,
    range.fromDate,
    range.toDateExclusive,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Payroll"
        title="Payroll Summary"
        description="Transparent calculations based on tracked time and configured pay type. Use breakdown export for daily clock in/out detail."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/app/payroll/export?from=${range.from}&to=${range.to}`}
              className="inline-flex items-center gap-2 rounded-xl border bg-surface px-3 py-2 text-sm font-semibold text-foreground-muted hover:bg-accent-soft hover:text-foreground"
            >
              <Download className="h-4 w-4" />
              Export Summary CSV
            </Link>
            <Link
              href={`/app/payroll/export?from=${range.from}&to=${range.to}&type=breakdown`}
              className="inline-flex items-center gap-2 rounded-xl border bg-surface px-3 py-2 text-sm font-semibold text-foreground-muted hover:bg-accent-soft hover:text-foreground"
            >
              <Download className="h-4 w-4" />
              Export Breakdown CSV
            </Link>
          </div>
        }
      />

      <Card>
        <CardContent className="space-y-4 py-6">
          <div>
            <CardTitle className="text-base">Pay period</CardTitle>
            <CardDescription>Select range to refresh totals and export.</CardDescription>
          </div>
          <form className="flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-sm">
              <span className="text-foreground-muted">From</span>
              <input
                name="from"
                type="date"
                defaultValue={range.from}
                className="h-10 rounded-xl border bg-surface px-3"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-foreground-muted">To</span>
              <input
                name="to"
                type="date"
                defaultValue={range.to}
                className="h-10 rounded-xl border bg-surface px-3"
              />
            </label>
            <button
              type="submit"
              className="h-10 rounded-xl border bg-surface-strong px-4 text-sm font-semibold hover:bg-accent-soft"
            >
              Apply range
            </button>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Team Members" value={`${summary.rows.length}`} />
        <StatCard label="Total Hours" value={`${summary.totalHours.toFixed(2)}h`} />
        <StatCard label="Base Pay" value={formatMoney(summary.totalBasePayCents)} />
        <StatCard
          label="Incentive Pay"
          value={formatMoney(summary.totalIncentivePayCents)}
        />
        <StatCard label="Total Pay" value={formatMoney(summary.totalPayCents)} />
      </section>

      <Card>
        <CardContent className="space-y-3 py-6">
          <div>
            <CardTitle className="text-base">Summary by team member</CardTitle>
            <CardDescription>
              Hourly uses shift hours. Piece work uses work-order timer hours. Salary uses a flat period amount.
            </CardDescription>
          </div>
          {summary.rows.length ? (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Member</TableHeaderCell>
                    <TableHeaderCell>Role</TableHeaderCell>
                    <TableHeaderCell>Pay Type</TableHeaderCell>
                    <TableHeaderCell>Pay Rate</TableHeaderCell>
                    <TableHeaderCell>Hours</TableHeaderCell>
                    <TableHeaderCell>Base Pay</TableHeaderCell>
                    <TableHeaderCell>Incentive Pay</TableHeaderCell>
                    <TableHeaderCell>Total Pay</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {summary.rows.map((row) => (
                    <TableRow key={row.membershipId}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span>{row.fullName}</span>
                          <span className="text-xs text-foreground-muted">{row.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="neutral">{formatRole(row.role)}</Badge>
                      </TableCell>
                      <TableCell>{formatPayType(row.payType)}</TableCell>
                      <TableCell>{formatMoney(row.payRateCents)}</TableCell>
                      <TableCell>{row.hoursWorked.toFixed(2)}</TableCell>
                      <TableCell>{formatMoney(row.basePayCents)}</TableCell>
                      <TableCell>{formatMoney(row.incentivePayCents)}</TableCell>
                      <TableCell>{formatMoney(row.totalPayCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <EmptyState
              title="No tracked time in this period"
              description="Shift hours will appear here once team members track time in the selected range."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
