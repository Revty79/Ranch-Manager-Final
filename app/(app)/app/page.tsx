import Link from "next/link";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
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
import {
  animalEvents,
  animalLocationAssignments,
  animals,
  grazingPeriods,
  landUnits,
  ranchMemberships,
  shifts,
  users,
  workOrders,
} from "@/lib/db/schema";
import { getGrazingMoveAlertSummary } from "@/lib/grazing/queries";
import { getProtocolDueItemsForRanch } from "@/lib/herd/protocol-queries";
import { formatAnimalSpecies } from "@/lib/herd/constants";
import { resolvePayrollDateRange } from "@/lib/payroll/date-range";
import { getPayrollSummaryForRange } from "@/lib/payroll/queries";
import { getWorkOrdersForRanch } from "@/lib/work-orders/queries";
import { cn } from "@/lib/utils";

const GRAZING_MOVE_SOON_HOURS = 72;

function formatMoveCountdown(hoursUntilMove: number): string {
  if (hoursUntilMove <= 0) {
    const overdueHours = Math.abs(hoursUntilMove);
    if (overdueHours === 0) return "move now";
    if (overdueHours < 24) return `${overdueHours}h overdue`;
    return `${Math.ceil(overdueHours / 24)}d overdue`;
  }
  if (hoursUntilMove < 24) return `in ${hoursUntilMove}h`;
  return `in ${Math.ceil(hoursUntilMove / 24)}d`;
}

function formatDateTimeForZone(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(value);
}

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
    [activeAnimalsCountRow],
    [birthsCountRow],
    [lossesCountRow],
    [dispositionsCountRow],
    [occupiedUnitsCountRow],
    [activeGrazingCountRow],
    grazingMoveAlerts,
    dueItems,
    recentMovementRows,
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
    db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(animals)
      .where(and(eq(animals.ranchId, context.ranch.id), eq(animals.status, "active"))),
    db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(animalEvents)
      .where(
        and(
          eq(animalEvents.ranchId, context.ranch.id),
          eq(animalEvents.eventType, "birth"),
          sql`${animalEvents.occurredAt} >= now() - interval '30 days'`,
        ),
      ),
    db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(animalEvents)
      .where(
        and(
          eq(animalEvents.ranchId, context.ranch.id),
          eq(animalEvents.eventType, "death"),
          sql`${animalEvents.occurredAt} >= now() - interval '30 days'`,
        ),
      ),
    db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(animalEvents)
      .where(
        and(
          eq(animalEvents.ranchId, context.ranch.id),
          inArray(animalEvents.eventType, ["sale_disposition", "cull"]),
          sql`${animalEvents.occurredAt} >= now() - interval '30 days'`,
        ),
      ),
    db
      .select({
        count: sql<number>`count(distinct ${animalLocationAssignments.landUnitId})::int`,
      })
      .from(animalLocationAssignments)
      .where(
        and(
          eq(animalLocationAssignments.ranchId, context.ranch.id),
          eq(animalLocationAssignments.isActive, true),
        ),
      ),
    db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(grazingPeriods)
      .where(
        and(
          eq(grazingPeriods.ranchId, context.ranch.id),
          inArray(grazingPeriods.status, ["active", "planned"]),
        ),
      ),
    getGrazingMoveAlertSummary(context.ranch.id, {
      soonHours: GRAZING_MOVE_SOON_HOURS,
      limit: 8,
    }),
    getProtocolDueItemsForRanch(context.ranch.id, { limit: 300 }),
    db
      .select({
        assignedAt: animalLocationAssignments.assignedAt,
        landUnitName: landUnits.name,
        animalTagId: animals.tagId,
        animalDisplayName: animals.displayName,
        species: animals.species,
      })
      .from(animalLocationAssignments)
      .innerJoin(landUnits, eq(animalLocationAssignments.landUnitId, landUnits.id))
      .innerJoin(animals, eq(animalLocationAssignments.animalId, animals.id))
      .where(eq(animalLocationAssignments.ranchId, context.ranch.id))
      .orderBy(desc(animalLocationAssignments.assignedAt))
      .limit(8),
  ]);

  const activeCrewCount = activeCrewRows.filter(
    (member) => !isPlatformAdminEmail(member.email),
  ).length;
  const openWorkOrdersCount = openWorkOrdersCountRow?.count ?? 0;
  const activeShiftsCount = activeShiftRows.filter(
    (member) => !isPlatformAdminEmail(member.email),
  ).length;
  const activeAnimalsCount = activeAnimalsCountRow?.count ?? 0;
  const birthsLast30 = birthsCountRow?.count ?? 0;
  const lossesLast30 = lossesCountRow?.count ?? 0;
  const dispositionsLast30 = dispositionsCountRow?.count ?? 0;
  const occupiedUnitsCount = occupiedUnitsCountRow?.count ?? 0;
  const activeGrazingCount = activeGrazingCountRow?.count ?? 0;
  const moveDueNowCount = grazingMoveAlerts.dueNowCount;
  const moveDueSoonCount = grazingMoveAlerts.dueSoonCount;
  const moveOverdueCount = grazingMoveAlerts.overdueCount;
  const dueAttentionCount = dueItems.filter(
    (item) => item.dueState === "due_soon" || item.dueState === "overdue",
  ).length;
  const overdueDueCount = dueItems.filter((item) => item.dueState === "overdue").length;
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
  const movementRows = recentMovementRows.map((row) => [
    row.landUnitName,
    row.animalDisplayName ? `${row.animalDisplayName} (${row.animalTagId})` : row.animalTagId,
    formatAnimalSpecies(row.species),
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: context.user.timeZone,
    }).format(row.assignedAt),
  ]);
  const grazingMoveRows = grazingMoveAlerts.rows.map((row) => [
    row.landUnitName,
    formatDateTimeForZone(row.moveBy, context.user.timeZone),
    formatMoveCountdown(row.hoursUntilMove),
    row.source === "occupancy_estimate" ? "occupancy estimate" : "recorded period",
  ]);
  const dueRows = dueItems
    .filter((item) => item.dueState === "overdue" || item.dueState === "due_soon")
    .slice(0, 8)
    .map((item) => [
      item.animalDisplayName ? `${item.animalDisplayName} (${item.animalTagId})` : item.animalTagId,
      item.protocolName,
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: context.user.timeZone,
      }).format(item.dueAt),
      item.dueState === "overdue"
        ? `${Math.abs(item.daysUntilDue)}d overdue`
        : item.daysUntilDue === 0
          ? "due today"
          : `due in ${item.daysUntilDue}d`,
    ]);
  const hasCoreOpsActivity =
    recentRows.length > 0 || activeShiftsCount > 0 || openWorkOrdersCount > 0;
  const hasHerdLandActivity =
    movementRows.length > 0 ||
    grazingMoveRows.length > 0 ||
    dueAttentionCount > 0 ||
    activeAnimalsCount > 0 ||
    occupiedUnitsCount > 0 ||
    activeGrazingCount > 0;
  const hasLiveActivity = hasCoreOpsActivity || hasHerdLandActivity;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="App Home"
        title="Operations Dashboard"
        description="A clean snapshot of crew, work, payroll, herd lifecycle visibility, and land-use activity."
        actions={
          <div className="flex flex-wrap gap-2">
            {(context.membership.role === "owner" || context.membership.role === "manager") ? (
              <Link
                href="/app/needs-attention"
                className={cn(buttonVariants({ variant: "secondary" }))}
              >
                Needs Attention
              </Link>
            ) : null}
            <Link href="/app/work-orders" className={cn(buttonVariants())}>
              New Work Order
            </Link>
          </div>
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Active Animals"
          value={`${activeAnimalsCount}`}
          trend={`${birthsLast30} births, ${lossesLast30} losses, ${dispositionsLast30} dispositions (30d)`}
        />
        <StatCard
          label="Breeding/Health Due"
          value={`${dueAttentionCount}`}
          trend={
            dueAttentionCount > 0
              ? `${overdueDueCount} overdue`
              : "No due or overdue reminders"
          }
        />
        <StatCard
          label="Occupied Land Units"
          value={`${occupiedUnitsCount}`}
          trend={occupiedUnitsCount > 0 ? "Units with current occupants" : "No current occupancy"}
        />
        <StatCard
          label="Active Grazing Periods"
          value={`${activeGrazingCount}`}
          trend={activeGrazingCount > 0 ? "Planned or active rotation windows" : "No grazing periods yet"}
        />
        <StatCard
          label="Move Now / Overdue"
          value={`${moveDueNowCount}`}
          trend={
            moveDueNowCount > 0 || moveDueSoonCount > 0
              ? `${moveDueSoonCount} due soon (${GRAZING_MOVE_SOON_HOURS}h), ${moveOverdueCount} overdue`
              : "No projected move alerts right now"
          }
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

      <section>
        <SectionHeader
          title="Due Attention"
          description="Breeding and health reminders that are due soon or overdue."
          action={
            <Link
              href="/app/herd/breeding"
              className="text-sm font-semibold text-accent hover:underline"
            >
              Open full due list
            </Link>
          }
        />
        <DataTableShell
          columns={["Animal", "Protocol", "Due", "State"]}
          rows={dueRows}
          emptyLabel="No due or overdue breeding/health items right now."
        />
      </section>

      <section>
        <SectionHeader
          title="Grazing Move Alerts"
          description={`Projected move deadlines due now or within ${GRAZING_MOVE_SOON_HOURS} hours.`}
          action={
            <Link
              href="/app/land/grazing"
              className="text-sm font-semibold text-accent hover:underline"
            >
              Open grazing planner
            </Link>
          }
        />
        <DataTableShell
          columns={["Land Unit", "Move By", "Countdown", "Source"]}
          rows={grazingMoveRows}
          emptyLabel={`No grazing moves due in the next ${GRAZING_MOVE_SOON_HOURS} hours.`}
        />
      </section>

      <section>
        <SectionHeader
          title="Recent Movement"
          description="Latest land-unit movement activity across herd and horse occupancy."
        />
        <DataTableShell
          columns={["Land Unit", "Animal", "Species", "Moved"]}
          rows={movementRows}
          emptyLabel="No movement history yet. Use /app/land to assign or move animals."
        />
      </section>

      {!hasLiveActivity ? (
        <EmptyState
          title="No live activity yet"
          description="Create your first work order, add team members, register animals, and assign occupancy to populate this dashboard."
          icon={<ClipboardList className="h-5 w-5 text-accent" />}
          action={
            <Link href="/app/work-orders" className={cn(buttonVariants({ variant: "secondary" }))}>
              Open operations
            </Link>
          }
        />
      ) : null}
    </div>
  );
}
