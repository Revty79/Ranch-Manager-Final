import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
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
import { isPlatformAdminEmail } from "@/lib/auth/platform-admin";
import { db } from "@/lib/db/client";
import {
  ranchMemberships,
  shifts,
  users,
  workOrders,
  workTimeEntries,
} from "@/lib/db/schema";
import { getGrazingMoveAlertSummary } from "@/lib/grazing/queries";
import { getProtocolDueItemsForRanch } from "@/lib/herd/protocol-queries";
import { getPayrollPeriodWorkspace } from "@/lib/payroll/period-queries";
import { getWorkOrdersForRanch } from "@/lib/work-orders/queries";

const STALE_SHIFT_HOURS = 12;
const STALE_WORK_TIMER_HOURS = 8;
const GRAZING_SOON_HOURS = 72;

function formatDate(value: Date | null, timeZone: string): string {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(value);
}

function formatDateTime(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(value);
}

function hoursSince(value: Date): number {
  return Math.max(Math.floor((Date.now() - value.getTime()) / (1000 * 60 * 60)), 0);
}

function formatDueState(daysUntilDue: number, dueState: "overdue" | "due_soon" | "upcoming"): string {
  if (dueState === "overdue") {
    return `${Math.abs(daysUntilDue)}d overdue`;
  }
  if (daysUntilDue === 0) {
    return "due today";
  }
  return `due in ${daysUntilDue}d`;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function NeedsAttentionPage() {
  const context = await requireRole(["owner", "manager"]);
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);

  const [
    workOrderRows,
    dueProtocolItems,
    grazingAlerts,
    payrollWorkspace,
    activeShiftRows,
    activeWorkRows,
  ] = await Promise.all([
    getWorkOrdersForRanch(context.ranch.id, { status: "all" }),
    getProtocolDueItemsForRanch(context.ranch.id, { limit: 300 }),
    getGrazingMoveAlertSummary(context.ranch.id, {
      soonHours: GRAZING_SOON_HOURS,
      limit: 12,
    }),
    getPayrollPeriodWorkspace(context.ranch.id),
    db
      .select({
        shiftId: shifts.id,
        membershipId: shifts.membershipId,
        startedAt: shifts.startedAt,
        pausedAt: shifts.pausedAt,
        fullName: users.fullName,
        email: users.email,
      })
      .from(shifts)
      .innerJoin(ranchMemberships, eq(shifts.membershipId, ranchMemberships.id))
      .innerJoin(users, eq(ranchMemberships.userId, users.id))
      .where(and(eq(shifts.ranchId, context.ranch.id), isNull(shifts.endedAt))),
    db
      .select({
        entryId: workTimeEntries.id,
        membershipId: workTimeEntries.membershipId,
        startedAt: workTimeEntries.startedAt,
        workOrderId: workOrders.id,
        workOrderTitle: workOrders.title,
        fullName: users.fullName,
        email: users.email,
      })
      .from(workTimeEntries)
      .innerJoin(workOrders, eq(workTimeEntries.workOrderId, workOrders.id))
      .innerJoin(ranchMemberships, eq(workTimeEntries.membershipId, ranchMemberships.id))
      .innerJoin(users, eq(ranchMemberships.userId, users.id))
      .where(and(eq(workTimeEntries.ranchId, context.ranch.id), isNull(workTimeEntries.endedAt))),
  ]);

  const overdueWorkOrders = workOrderRows.filter(
    (order) =>
      Boolean(order.dueAt) &&
      (order.status === "draft" || order.status === "open" || order.status === "in_progress") &&
      (order.dueAt as Date).getTime() < now.getTime(),
  );
  const pendingReviewOrders = workOrderRows.filter(
    (order) => order.completionReviewStatus === "pending",
  );
  const dueAttentionItems = dueProtocolItems.filter(
    (item) => item.dueState === "overdue" || item.dueState === "due_soon",
  );

  const staleShifts = activeShiftRows
    .filter((row) => !isPlatformAdminEmail(row.email))
    .filter((row) => hoursSince(row.startedAt) >= STALE_SHIFT_HOURS);
  const staleWorkTimers = activeWorkRows
    .filter((row) => !isPlatformAdminEmail(row.email))
    .filter((row) => hoursSince(row.startedAt) >= STALE_WORK_TIMER_HOURS);

  const overdueOpenPeriods = payrollWorkspace.periods.filter(
    (period) => period.status === "open" && period.payDate < todayKey,
  );
  const selectedPeriod = payrollWorkspace.selectedPeriod;
  const outstandingAdvanceRows = payrollWorkspace.ledgerRows.filter(
    (row) => row.advanceRemainingCents > 0,
  );
  const unpaidCheckRows =
    selectedPeriod?.status === "paid"
      ? payrollWorkspace.ledgerRows.filter(
          (row) => row.netPayableCents > 0 && !row.isCheckPickedUp,
        )
      : [];
  const missingPayrollPeriodsCount = payrollWorkspace.periods.length === 0 ? 1 : 0;
  const payrollAttentionCount =
    overdueOpenPeriods.length +
    outstandingAdvanceRows.length +
    unpaidCheckRows.length +
    missingPayrollPeriodsCount;

  const totalAttentionCount =
    overdueWorkOrders.length +
    pendingReviewOrders.length +
    staleShifts.length +
    staleWorkTimers.length +
    payrollAttentionCount +
    dueAttentionItems.length +
    grazingAlerts.rows.length;
  const attentionBreakdown = [
    {
      label: "Overdue work orders",
      count: overdueWorkOrders.length,
      href: "#overdue-work-orders",
    },
    {
      label: "Pending completion reviews",
      count: pendingReviewOrders.length,
      href: "#pending-completion-reviews",
    },
    {
      label: "Stale active shifts",
      count: staleShifts.length,
      href: "#stale-shift-state",
    },
    {
      label: "Stale work timers",
      count: staleWorkTimers.length,
      href: "#stale-work-timers",
    },
    {
      label: "Payroll attention points",
      count: payrollAttentionCount,
      href: "#payroll-attention",
    },
    {
      label: "Herd protocol due items",
      count: dueAttentionItems.length,
      href: "#herd-protocol-due-items",
    },
    {
      label: "Grazing move alerts",
      count: grazingAlerts.rows.length,
      href: "#grazing-move-alerts",
    },
  ].filter((item) => item.count > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Manager Ops"
        title="Needs Attention"
        description="One place for operational exceptions across work, time, payroll, herd protocol, and grazing movement."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/app/work-orders"
              className="rounded-xl border bg-surface px-3 py-2 text-sm font-semibold text-foreground-muted hover:bg-accent-soft hover:text-foreground"
            >
              Open Work Orders
            </Link>
            <Link
              href="/app/payroll"
              className="rounded-xl border bg-surface px-3 py-2 text-sm font-semibold text-foreground-muted hover:bg-accent-soft hover:text-foreground"
            >
              Open Payroll
            </Link>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Attention Items" value={`${totalAttentionCount}`} />
        <StatCard label="Overdue Work Orders" value={`${overdueWorkOrders.length}`} />
        <StatCard label="Pending Reviews" value={`${pendingReviewOrders.length}`} />
        <StatCard
          label="Stale Active Time"
          value={`${staleShifts.length + staleWorkTimers.length}`}
          trend={`Shifts ${staleShifts.length}, timers ${staleWorkTimers.length}`}
        />
      </section>

      <Card>
        <CardContent className="space-y-3 py-6">
          <div>
            <CardTitle className="text-base">Attention Breakdown</CardTitle>
            <CardDescription>
              Every item counted in &quot;Total Attention Items&quot; is listed here.
            </CardDescription>
          </div>
          {attentionBreakdown.length ? (
            <ul className="space-y-2">
              {attentionBreakdown.map((item) => (
                <li
                  key={item.label}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-surface px-3 py-2"
                >
                  <span className="text-sm">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="warning">{item.count}</Badge>
                    <Link
                      href={item.href}
                      className="text-xs font-semibold text-accent hover:underline"
                    >
                      View section
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-foreground-muted">No active attention items.</p>
          )}
        </CardContent>
      </Card>

      <Card id="overdue-work-orders">
        <CardContent className="space-y-4 py-6">
          <div>
            <CardTitle className="text-base">Overdue Work Orders</CardTitle>
            <CardDescription>
              Open work items with due dates already passed.
            </CardDescription>
          </div>
          {overdueWorkOrders.length ? (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Work Order</TableHeaderCell>
                    <TableHeaderCell>Due</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell>Assignees</TableHeaderCell>
                    <TableHeaderCell className="text-right">Open</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {overdueWorkOrders.slice(0, 15).map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>{order.title}</TableCell>
                      <TableCell>{formatDate(order.dueAt, context.user.timeZone)}</TableCell>
                      <TableCell>
                        <Badge variant="danger">{order.status.replace("_", " ")}</Badge>
                      </TableCell>
                      <TableCell>
                        {order.assignees.length
                          ? order.assignees.map((assignee) => assignee.fullName).join(", ")
                          : "Unassigned"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/app/work-orders/${order.id}`}
                          className="rounded-lg border px-2.5 py-1 text-xs font-semibold text-foreground-muted hover:bg-accent-soft hover:text-foreground"
                        >
                          Review
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <p className="text-sm text-foreground-muted">No overdue work orders.</p>
          )}
        </CardContent>
      </Card>

      <Card id="pending-completion-reviews">
        <CardContent className="space-y-4 py-6">
          <div>
            <CardTitle className="text-base">Pending Completion Reviews</CardTitle>
            <CardDescription>
              Work completed by crew and waiting on manager review.
            </CardDescription>
          </div>
          {pendingReviewOrders.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {pendingReviewOrders.slice(0, 12).map((order) => (
                <Link
                  key={order.id}
                  href={`/app/work-orders/${order.id}`}
                  className="rounded-xl border bg-surface p-3 hover:bg-accent-soft/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{order.title}</p>
                    <Badge variant="warning">Pending review</Badge>
                  </div>
                  <p className="mt-1 text-sm text-foreground-muted">
                    Requested {formatDate(order.completionReviewRequestedAt, context.user.timeZone)}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-foreground-muted">No completion reviews are pending.</p>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card id="stale-shift-state">
          <CardContent className="space-y-4 py-6">
            <div>
              <CardTitle className="text-base">Stale Shift State</CardTitle>
              <CardDescription>
                Active shifts running at least {STALE_SHIFT_HOURS} hours.
              </CardDescription>
            </div>
            {staleShifts.length ? (
              <ul className="space-y-2">
                {staleShifts.map((row) => (
                  <li key={row.shiftId} className="rounded-xl border bg-surface px-3 py-2">
                    <p className="font-semibold">{row.fullName}</p>
                    <p className="text-sm text-foreground-muted">
                      Shift started {formatDateTime(row.startedAt, context.user.timeZone)} (
                      {hoursSince(row.startedAt)}h active)
                    </p>
                    <p className="text-xs text-foreground-muted">
                      {row.pausedAt ? "Paused shift still open." : "Shift still active."}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-foreground-muted">No stale active shifts detected.</p>
            )}
          </CardContent>
        </Card>

        <Card id="stale-work-timers">
          <CardContent className="space-y-4 py-6">
            <div>
              <CardTitle className="text-base">Stale Work Timers</CardTitle>
              <CardDescription>
                Active work timers running at least {STALE_WORK_TIMER_HOURS} hours.
              </CardDescription>
            </div>
            {staleWorkTimers.length ? (
              <ul className="space-y-2">
                {staleWorkTimers.map((row) => (
                  <li key={row.entryId} className="rounded-xl border bg-surface px-3 py-2">
                    <p className="font-semibold">{row.fullName}</p>
                    <p className="text-sm text-foreground-muted">
                      {row.workOrderTitle} started {formatDateTime(row.startedAt, context.user.timeZone)} (
                      {hoursSince(row.startedAt)}h)
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-foreground-muted">No stale work timers detected.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <Card id="payroll-attention">
        <CardContent className="space-y-4 py-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Payroll Attention</CardTitle>
              <CardDescription>
                Open past-due periods, unresolved advances, and unpicked paid checks where derivable.
              </CardDescription>
            </div>
            <Link
              href="/app/payroll"
              className="rounded-lg border px-2.5 py-1 text-xs font-semibold text-foreground-muted hover:bg-accent-soft hover:text-foreground"
            >
              Open payroll
            </Link>
          </div>
          {payrollWorkspace.periods.length === 0 ? (
            <p className="rounded-xl border bg-surface px-3 py-2 text-sm">
              No payroll periods are configured yet. This counts as 1 attention item.
            </p>
          ) : null}
          {overdueOpenPeriods.length ? (
            <p className="rounded-xl border bg-surface px-3 py-2 text-sm">
              Open periods past pay date: {overdueOpenPeriods.length}
            </p>
          ) : null}
          {selectedPeriod ? (
            <p className="rounded-xl border bg-surface px-3 py-2 text-sm">
              Selected period: {selectedPeriod.periodStart} to {selectedPeriod.periodEnd} (
              {selectedPeriod.status})
            </p>
          ) : null}
          {outstandingAdvanceRows.length ? (
            <p className="rounded-xl border bg-surface px-3 py-2 text-sm">
              Team members carrying unresolved advance balance: {outstandingAdvanceRows.length}
            </p>
          ) : null}
          {unpaidCheckRows.length ? (
            <p className="rounded-xl border bg-surface px-3 py-2 text-sm">
              Paid-period checks not marked picked up: {unpaidCheckRows.length}
            </p>
          ) : null}
          {payrollAttentionCount === 0 ? (
            <p className="text-sm text-foreground-muted">No payroll exceptions detected.</p>
          ) : null}
          {outstandingAdvanceRows.length ? (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Member</TableHeaderCell>
                    <TableHeaderCell>Advance Remaining</TableHeaderCell>
                    <TableHeaderCell>Carry To Next</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {outstandingAdvanceRows.slice(0, 12).map((row) => (
                    <TableRow key={row.membershipId}>
                      <TableCell>{row.fullName}</TableCell>
                      <TableCell>{formatMoney(row.advanceRemainingCents)}</TableCell>
                      <TableCell>{formatMoney(row.willCarryToNextCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : null}
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card id="herd-protocol-due-items">
          <CardContent className="space-y-4 py-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Herd Protocol Due Items</CardTitle>
                <CardDescription>Due-soon and overdue breeding/health protocols.</CardDescription>
              </div>
              <Link
                href="/app/herd/breeding"
                className="rounded-lg border px-2.5 py-1 text-xs font-semibold text-foreground-muted hover:bg-accent-soft hover:text-foreground"
              >
                Open breeding
              </Link>
            </div>
            {dueAttentionItems.length ? (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Animal</TableHeaderCell>
                      <TableHeaderCell>Protocol</TableHeaderCell>
                      <TableHeaderCell>Due</TableHeaderCell>
                      <TableHeaderCell>State</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dueAttentionItems.slice(0, 12).map((item) => (
                      <TableRow key={`${item.protocolId}-${item.animalId}`}>
                        <TableCell>
                          {item.animalDisplayName
                            ? `${item.animalDisplayName} (${item.animalTagId})`
                            : item.animalTagId}
                        </TableCell>
                        <TableCell>{item.protocolName}</TableCell>
                        <TableCell>{formatDate(item.dueAt, context.user.timeZone)}</TableCell>
                        <TableCell>
                          <Badge variant={item.dueState === "overdue" ? "danger" : "warning"}>
                            {formatDueState(item.daysUntilDue, item.dueState)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <p className="text-sm text-foreground-muted">
                No due-soon or overdue protocol items.
              </p>
            )}
          </CardContent>
        </Card>

        <Card id="grazing-move-alerts">
          <CardContent className="space-y-4 py-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Grazing Move Alerts</CardTitle>
                <CardDescription>
                  Move deadlines due now or in the next {GRAZING_SOON_HOURS} hours.
                </CardDescription>
              </div>
              <Link
                href="/app/land/grazing"
                className="rounded-lg border px-2.5 py-1 text-xs font-semibold text-foreground-muted hover:bg-accent-soft hover:text-foreground"
              >
                Open grazing
              </Link>
            </div>
            {grazingAlerts.rows.length ? (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Land Unit</TableHeaderCell>
                      <TableHeaderCell>Move By</TableHeaderCell>
                      <TableHeaderCell>Countdown</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {grazingAlerts.rows.map((row) => (
                      <TableRow key={row.periodId}>
                        <TableCell>{row.landUnitName}</TableCell>
                        <TableCell>{formatDateTime(row.moveBy, context.user.timeZone)}</TableCell>
                        <TableCell>
                          <Badge variant={row.hoursUntilMove < 0 ? "danger" : "warning"}>
                            {row.hoursUntilMove <= 0
                              ? `${Math.abs(row.hoursUntilMove)}h overdue`
                              : `in ${row.hoursUntilMove}h`}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <p className="text-sm text-foreground-muted">
                No grazing moves due in the alert window.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
