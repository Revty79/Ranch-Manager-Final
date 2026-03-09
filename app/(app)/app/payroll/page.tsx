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
        description="Transparent launch calculations based on tracked shift hours."
        actions={
          <Link
            href={`/app/payroll/export?from=${range.from}&to=${range.to}`}
            className="inline-flex items-center gap-2 rounded-xl border bg-surface px-3 py-2 text-sm font-semibold text-foreground-muted hover:bg-accent-soft hover:text-foreground"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Link>
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

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Team Members" value={`${summary.rows.length}`} />
        <StatCard label="Total Hours" value={`${summary.totalHours.toFixed(2)}h`} />
        <StatCard label="Estimated Pay" value={formatMoney(summary.totalEstimatedPayCents)} />
      </section>

      <Card>
        <CardContent className="space-y-3 py-6">
          <div>
            <CardTitle className="text-base">Summary by team member</CardTitle>
            <CardDescription>
              Hourly members use `hours x rate`. Salary members use flat period amount.
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
                    <TableHeaderCell>Estimated Pay</TableHeaderCell>
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
                        <Badge variant="neutral">{row.role}</Badge>
                      </TableCell>
                      <TableCell>{row.payType}</TableCell>
                      <TableCell>{formatMoney(row.payRateCents)}</TableCell>
                      <TableCell>{row.hoursWorked.toFixed(2)}</TableCell>
                      <TableCell>{formatMoney(row.estimatedPayCents)}</TableCell>
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
