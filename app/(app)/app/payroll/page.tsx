import Link from "next/link";
import { Download } from "lucide-react";
import { PayPeriodForms } from "@/components/payroll/pay-period-forms";
import { EmptyState } from "@/components/patterns/empty-state";
import { PageHeader } from "@/components/patterns/page-header";
import { StatCard } from "@/components/patterns/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  setPayrollMemberCheckPickupAction,
  setPayrollPeriodPaidStateAction,
} from "@/lib/payroll/period-actions";
import { resolvePayrollDateRange } from "@/lib/payroll/date-range";
import { getPayrollPeriodWorkspace } from "@/lib/payroll/period-queries";
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

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatDateTime(value: Date | null): string {
  if (!value) {
    return "Not marked";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; periodId?: string }>;
}) {
  const context = await requireRole(["owner", "manager"]);
  const params = await searchParams;
  const range = resolvePayrollDateRange(params.from, params.to);
  const canManagePayroll = context.membership.role === "owner";
  const [summary, periodWorkspace] = await Promise.all([
    getPayrollSummaryForRange(context.ranch.id, range.fromDate, range.toDateExclusive),
    getPayrollPeriodWorkspace(context.ranch.id, params.periodId),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Payroll"
        title="Payroll Summary"
        description="Transparent calculations based on tracked time and configured pay type. Use period controls below for payday settings, advances, and rollover tracking."
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

      {periodWorkspace ? (
        <>
          <Card>
            <CardContent className="space-y-4 py-6">
              <div>
                <CardTitle className="text-base">Payroll schedule & period advances</CardTitle>
                <CardDescription>
                  Owners can define payroll cycles, assign advances to a pay period, mark periods
                  paid, and track uncollected checks that roll into later periods.
                </CardDescription>
              </div>
              <PayPeriodForms
                canManage={canManagePayroll}
                settings={periodWorkspace.settings}
                selectedPeriod={periodWorkspace.selectedPeriod}
                memberOptions={periodWorkspace.memberOptions}
              />
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Pay Period</TableHeaderCell>
                      <TableHeaderCell>Pay Date</TableHeaderCell>
                      <TableHeaderCell>Status</TableHeaderCell>
                      <TableHeaderCell>Paid At</TableHeaderCell>
                      <TableHeaderCell className="text-right">View</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {periodWorkspace.periods.slice(0, 16).map((period) => {
                      const isSelected = period.id === periodWorkspace.selectedPeriod.id;
                      return (
                        <TableRow key={period.id} className={isSelected ? "bg-accent-soft/30" : ""}>
                          <TableCell>
                            {formatDate(period.periodStart)} to {formatDate(period.periodEnd)}
                          </TableCell>
                          <TableCell>{formatDate(period.payDate)}</TableCell>
                          <TableCell>
                            <Badge variant={period.status === "paid" ? "success" : "warning"}>
                              {period.status === "paid" ? "Paid" : "Open"}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDateTime(period.paidAt)}</TableCell>
                          <TableCell className="text-right">
                            <Link
                              href={`/app/payroll?from=${range.from}&to=${range.to}&periodId=${period.id}`}
                              className="inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold text-foreground-muted hover:bg-accent-soft hover:text-foreground"
                            >
                              {isSelected ? "Selected" : "View"}
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 py-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">
                    Selected period ledger: {formatDate(periodWorkspace.selectedPeriod.periodStart)}{" "}
                    to {formatDate(periodWorkspace.selectedPeriod.periodEnd)}
                  </CardTitle>
                  <CardDescription>
                    Advance balances and unpaid checks roll automatically into the next period.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      periodWorkspace.selectedPeriod.status === "paid" ? "success" : "warning"
                    }
                  >
                    {periodWorkspace.selectedPeriod.status === "paid" ? "Paid" : "Open"}
                  </Badge>
                  {canManagePayroll ? (
                    <form action={setPayrollPeriodPaidStateAction}>
                      <input type="hidden" name="periodId" value={periodWorkspace.selectedPeriod.id} />
                      <input
                        type="hidden"
                        name="setPaid"
                        value={periodWorkspace.selectedPeriod.status === "paid" ? "false" : "true"}
                      />
                      <Button size="sm" variant="secondary" type="submit">
                        {periodWorkspace.selectedPeriod.status === "paid"
                          ? "Reopen period"
                          : "Mark period paid"}
                      </Button>
                    </form>
                  ) : (
                    <span className="text-xs text-foreground-muted">
                      Owner controls only
                    </span>
                  )}
                </div>
              </div>

              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                <StatCard
                  label="Gross Earnings"
                  value={formatMoney(periodWorkspace.totals.totalGrossPayCents)}
                />
                <StatCard
                  label="Check Carry In"
                  value={formatMoney(periodWorkspace.totals.totalCarryInPayableCents)}
                />
                <StatCard
                  label="Advance Carry In"
                  value={formatMoney(periodWorkspace.totals.totalCarryInAdvanceCents)}
                />
                <StatCard
                  label="New Advances"
                  value={formatMoney(periodWorkspace.totals.totalPeriodAdvanceCents)}
                />
                <StatCard
                  label="Net Payable"
                  value={formatMoney(periodWorkspace.totals.totalNetPayableCents)}
                />
                <StatCard
                  label="Carry To Next"
                  value={formatMoney(periodWorkspace.totals.totalWillCarryToNextCents)}
                />
              </section>

              {periodWorkspace.ledgerRows.length ? (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>Member</TableHeaderCell>
                        <TableHeaderCell>Gross</TableHeaderCell>
                        <TableHeaderCell>Check Carry In</TableHeaderCell>
                        <TableHeaderCell>Advance Carry In</TableHeaderCell>
                        <TableHeaderCell>New Advance</TableHeaderCell>
                        <TableHeaderCell>Advance Applied</TableHeaderCell>
                        <TableHeaderCell>Net Payable</TableHeaderCell>
                        <TableHeaderCell>Advance Remaining</TableHeaderCell>
                        <TableHeaderCell>Carry To Next</TableHeaderCell>
                        <TableHeaderCell className="text-right">Check Pickup</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {periodWorkspace.ledgerRows.map((row) => (
                        <TableRow key={row.membershipId}>
                          <TableCell>{row.fullName}</TableCell>
                          <TableCell>{formatMoney(row.grossPayCents)}</TableCell>
                          <TableCell>{formatMoney(row.carryInPayableCents)}</TableCell>
                          <TableCell>{formatMoney(row.carryInAdvanceCents)}</TableCell>
                          <TableCell>{formatMoney(row.periodAdvanceCents)}</TableCell>
                          <TableCell>{formatMoney(row.advanceAppliedCents)}</TableCell>
                          <TableCell>{formatMoney(row.netPayableCents)}</TableCell>
                          <TableCell>{formatMoney(row.advanceRemainingCents)}</TableCell>
                          <TableCell>{formatMoney(row.willCarryToNextCents)}</TableCell>
                          <TableCell className="text-right">
                            {periodWorkspace.selectedPeriod.status === "paid" ? (
                              canManagePayroll ? (
                                <form action={setPayrollMemberCheckPickupAction}>
                                  <input
                                    type="hidden"
                                    name="periodId"
                                    value={periodWorkspace.selectedPeriod.id}
                                  />
                                  <input
                                    type="hidden"
                                    name="membershipId"
                                    value={row.membershipId}
                                  />
                                  <input
                                    type="hidden"
                                    name="setPicked"
                                    value={row.isCheckPickedUp ? "false" : "true"}
                                  />
                                  <Button size="sm" variant="secondary" type="submit">
                                    {row.isCheckPickedUp ? "Undo picked" : "Mark picked"}
                                  </Button>
                                </form>
                              ) : (
                                <span className="text-xs text-foreground-muted">
                                  {row.isCheckPickedUp ? "Picked up" : "Not picked"}
                                </span>
                              )
                            ) : (
                              <span className="text-xs text-foreground-muted">Pending payment</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <EmptyState
                  title="No payroll activity in selected period"
                  description="When this period has earnings, advances, or carry balances, they will appear here."
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 py-6">
              <div>
                <CardTitle className="text-base">Advances logged for selected period</CardTitle>
                <CardDescription>
                  Each advance applies to this period first, then rolls as remaining balance if
                  earnings are not enough to cover it.
                </CardDescription>
              </div>
              {periodWorkspace.selectedPeriodAdvances.length ? (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>Member</TableHeaderCell>
                        <TableHeaderCell>Amount</TableHeaderCell>
                        <TableHeaderCell>Note</TableHeaderCell>
                        <TableHeaderCell>Logged At</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {periodWorkspace.selectedPeriodAdvances.map((advance) => (
                        <TableRow key={advance.id}>
                          <TableCell>{advance.fullName}</TableCell>
                          <TableCell>{formatMoney(advance.amountCents)}</TableCell>
                          <TableCell>{advance.note || "-"}</TableCell>
                          <TableCell>{formatDateTime(advance.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <p className="text-sm text-foreground-muted">No advances logged for this period.</p>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

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
              Hourly uses shift hours. Piece work uses work-order timer hours. Salary uses a flat
              period amount.
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
