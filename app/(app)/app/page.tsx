import Link from "next/link";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { EmptyState } from "@/components/patterns/empty-state";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionHeader } from "@/components/patterns/section-header";
import { StatCard } from "@/components/patterns/stat-card";
import { DataTableShell } from "@/components/patterns/data-table-shell";
import { buttonVariants } from "@/components/ui/button";
import { ClipboardList } from "lucide-react";
import { isPlatformAdminEmail } from "@/lib/auth/platform-admin";
import { requirePaidAccessContext } from "@/lib/auth/context";
import { db } from "@/lib/db/client";
import { ranchMemberships, shifts, users, workOrders } from "@/lib/db/schema";
import { resolvePayrollDateRange } from "@/lib/payroll/date-range";
import { getPayrollSummaryForRange } from "@/lib/payroll/queries";
import { getWorkOrdersForRanch } from "@/lib/work-orders/queries";
import { cn } from "@/lib/utils";

export default async function AppHomePage() {
  const context = await requirePaidAccessContext();
  const canViewPayroll =
    context.membership.role === "owner" || context.membership.role === "manager";
  const payrollRange = resolvePayrollDateRange();

  const [
    activeCrewRows,
    [openWorkOrdersCountRow],
    activeShiftRows,
    recentWorkOrders,
    payrollSummary,
  ] = await Promise.all([
    db
      .select({
        email: users.email,
      })
      .from(ranchMemberships)
      .innerJoin(users, eq(ranchMemberships.userId, users.id))
      .where(
        and(
          eq(ranchMemberships.ranchId, context.ranch.id),
          eq(ranchMemberships.isActive, true),
        ),
      ),
    db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(workOrders)
      .where(
        and(
          eq(workOrders.ranchId, context.ranch.id),
          inArray(workOrders.status, ["draft", "open", "in_progress"]),
        ),
      ),
    db
      .select({
        email: users.email,
      })
      .from(shifts)
      .innerJoin(ranchMemberships, eq(shifts.membershipId, ranchMemberships.id))
      .innerJoin(users, eq(ranchMemberships.userId, users.id))
      .where(and(eq(shifts.ranchId, context.ranch.id), isNull(shifts.endedAt))),
    getWorkOrdersForRanch(context.ranch.id, { status: "all" }),
    canViewPayroll
      ? getPayrollSummaryForRange(
          context.ranch.id,
          payrollRange.fromDate,
          payrollRange.toDateExclusive,
        )
      : Promise.resolve(null),
  ]);

  const activeCrewCount = activeCrewRows.filter(
    (member) => !isPlatformAdminEmail(member.email),
  ).length;
  const openWorkOrdersCount = openWorkOrdersCountRow?.count ?? 0;
  const activeShiftsCount = activeShiftRows.filter(
    (member) => !isPlatformAdminEmail(member.email),
  ).length;
  const totalPayrollCents = payrollSummary?.totalPayCents ?? 0;
  const recentRows = recentWorkOrders.slice(0, 8).map((order) => {
    const dueLabel = order.dueAt
      ? new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          timeZone: context.user.timeZone,
        }).format(order.dueAt)
      : "Not set";
    const assigneeLabel = order.assignees.length
      ? order.assignees
          .slice(0, 2)
          .map((assignee) => assignee.fullName)
          .join(", ")
      : "Unassigned";
    return [
      order.title,
      order.assignees.length > 2 ? `${assigneeLabel} +${order.assignees.length - 2}` : assigneeLabel,
      dueLabel,
      `status: ${order.status.replace("_", " ")}`,
    ];
  });
  const hasLiveActivity = recentRows.length > 0 || activeShiftsCount > 0 || openWorkOrdersCount > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="App Home"
        title="Operations Dashboard"
        description="A clean snapshot of crew, work orders, active shifts, and payroll visibility."
        actions={
          <Link href="/app/work-orders" className={cn(buttonVariants())}>
            New Work Order
          </Link>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active Crew"
          value={`${activeCrewCount}`}
          trend={activeCrewCount > 0 ? "Active team memberships" : "Ready for first team setup"}
        />
        <StatCard
          label="Open Work Orders"
          value={`${openWorkOrdersCount}`}
          trend={openWorkOrdersCount > 0 ? "Draft, open, or in progress" : "No backlog yet"}
        />
        <StatCard
          label="Active Shifts"
          value={`${activeShiftsCount}`}
          trend={activeShiftsCount > 0 ? "Currently clocked in" : "Clock starts on first shift"}
        />
        <StatCard
          label="Payroll This Period"
          value={canViewPayroll ? `$${(totalPayrollCents / 100).toFixed(2)}` : "Restricted"}
          trend={canViewPayroll ? `${payrollRange.from} to ${payrollRange.to}` : "Owner/manager only"}
        />
      </section>

      <section>
        <SectionHeader
          title="Recent Work"
          description="Latest work orders across your ranch."
        />
        <DataTableShell
          columns={["Work Order", "Assigned", "Due", "Status"]}
          rows={recentRows}
          emptyLabel="No work orders yet. Create one to start tracking activity."
        />
      </section>

      {!hasLiveActivity ? (
        <EmptyState
          title="No live activity yet"
          description="Create your first work order, add team members, and start tracking time to populate this dashboard."
          icon={<ClipboardList className="h-5 w-5 text-accent" />}
          action={
            <Link href="/app/work-orders" className={cn(buttonVariants({ variant: "secondary" }))}>
              Go to work orders
            </Link>
          }
        />
      ) : null}
    </div>
  );
}
