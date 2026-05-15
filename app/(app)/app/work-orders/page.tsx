import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { CreateWorkOrderForm } from "@/components/work-orders/create-work-order-form";
import { CreateWorkOrderTemplateForm } from "@/components/work-orders/create-work-order-template-form";
import { IncentiveCountdown } from "@/components/work-orders/incentive-countdown";
import { EmptyState } from "@/components/patterns/empty-state";
import { PageHeader } from "@/components/patterns/page-header";
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
import { hasSectionAccess } from "@/lib/auth/capabilities";
import { requireSectionAccess } from "@/lib/auth/context";
import {
  createWorkOrderFromTemplateFormAction,
  updateWorkOrderTemplateRecurrenceFormAction,
} from "@/lib/work-orders/actions";
import { materializeDueRecurringWorkOrdersForRanch } from "@/lib/work-orders/maintenance";
import {
  getAssignedWorkForMembership,
  getAssignableMembersForRanch,
  getWorkOrderTemplatesForRanch,
  getWorkOrdersForRanch,
  type WorkOrderListItem,
} from "@/lib/work-orders/queries";
import { cn } from "@/lib/utils";

const statusTabs = ["all", "draft", "open", "in_progress", "completed", "cancelled"] as const;
const workerQueueTabs = ["active", "in_progress", "completed", "cancelled", "all"] as const;

function statusVariant(status: string) {
  if (status === "completed") {
    return "success";
  }
  if (status === "cancelled") {
    return "danger";
  }
  if (status === "in_progress") {
    return "warning";
  }

  return "neutral";
}

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

function formatDateKey(value: string | null, timeZone: string): string {
  if (!value) {
    return "Not set";
  }

  return formatDate(new Date(`${value}T00:00:00Z`), timeZone);
}

function formatStatus(status: string): string {
  return status.replace("_", " ");
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatCompensation(order: {
  compensationType: "standard" | "flat_amount";
  flatPayCents: number;
}): string {
  if (order.compensationType === "flat_amount") {
    return `Flat ${formatMoney(order.flatPayCents)}`;
  }

  return "Regular";
}

function reviewVariant(status: "pending" | "approved" | "changes_requested" | null) {
  if (status === "pending") {
    return "warning";
  }
  if (status === "approved") {
    return "success";
  }
  if (status === "changes_requested") {
    return "danger";
  }

  return "neutral";
}

function formatReviewStatus(status: "pending" | "approved" | "changes_requested" | null): string {
  if (!status) {
    return "Not required";
  }

  if (status === "changes_requested") {
    return "Changes requested";
  }

  return `Review ${status}`;
}

function formatRecurrenceLabel(template: {
  recurringEnabled: boolean;
  recurrenceCadence: "daily" | "weekly" | "monthly" | "custom" | null;
  recurrenceIntervalDays: number | null;
  nextGenerationOn: string | null;
}) {
  if (!template.recurringEnabled) {
    return "One-time template (manual generate)";
  }

  if (template.recurrenceCadence === "custom") {
    const interval = template.recurrenceIntervalDays ?? 1;
    return `Every ${interval} day${interval === 1 ? "" : "s"} - next ${template.nextGenerationOn ?? "not set"}`;
  }

  return `${template.recurrenceCadence ?? "unknown cadence"} - next ${template.nextGenerationOn ?? "not set"}`;
}

function isOpenStatus(status: WorkOrderListItem["status"]): boolean {
  return status === "draft" || status === "open" || status === "in_progress";
}

function isOverdue(order: WorkOrderListItem, now: Date): boolean {
  return isOpenStatus(order.status) && Boolean(order.dueAt) && order.dueAt!.getTime() < now.getTime();
}

function isDueSoon(order: WorkOrderListItem, now: Date): boolean {
  if (!isOpenStatus(order.status) || !order.dueAt) {
    return false;
  }

  const diff = order.dueAt.getTime() - now.getTime();
  return diff >= 0 && diff <= 24 * 60 * 60 * 1000;
}

function isUrgent(order: WorkOrderListItem, now: Date): boolean {
  return order.priority === "high" || isOverdue(order, now);
}

function dueSortWeight(order: WorkOrderListItem): number {
  if (!order.dueAt) {
    return Number.POSITIVE_INFINITY;
  }

  return order.dueAt.getTime();
}

function compareByAttention(left: WorkOrderListItem, right: WorkOrderListItem, now: Date): number {
  const leftOverdue = isOverdue(left, now);
  const rightOverdue = isOverdue(right, now);
  if (leftOverdue !== rightOverdue) {
    return leftOverdue ? -1 : 1;
  }

  const leftUrgent = isUrgent(left, now);
  const rightUrgent = isUrgent(right, now);
  if (leftUrgent !== rightUrgent) {
    return leftUrgent ? -1 : 1;
  }

  const leftInProgress = left.status === "in_progress";
  const rightInProgress = right.status === "in_progress";
  if (leftInProgress !== rightInProgress) {
    return leftInProgress ? -1 : 1;
  }

  const leftDue = dueSortWeight(left);
  const rightDue = dueSortWeight(right);
  if (leftDue !== rightDue) {
    return leftDue - rightDue;
  }

  return right.createdAt.getTime() - left.createdAt.getTime();
}

function formatQueueLabel(tab: (typeof workerQueueTabs)[number]): string {
  if (tab === "in_progress") {
    return "in progress";
  }

  return tab;
}

function formatDueState(order: WorkOrderListItem, timeZone: string, now: Date): string {
  if (!order.dueAt) {
    return "Not set";
  }

  if (isOverdue(order, now)) {
    return `${formatDate(order.dueAt, timeZone)} (overdue)`;
  }

  if (isDueSoon(order, now)) {
    return `${formatDate(order.dueAt, timeZone)} (due soon)`;
  }

  return formatDate(order.dueAt, timeZone);
}

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    q?: string;
    queue?: string;
    workOrderResult?: string;
    workOrderMessage?: string;
    templateResult?: string;
    templateMessage?: string;
  }>;
}) {
  const context = await requireSectionAccess("workOrders");
  const canManageWorkOrders = hasSectionAccess(
    context.membership.sectionAccess,
    "workOrders",
    "manage",
  );
  await materializeDueRecurringWorkOrdersForRanch(context.ranch.id);
  const params = await searchParams;
  const now = new Date();

  if (!canManageWorkOrders) {
    const assignedOrders = await getAssignedWorkForMembership(
      context.ranch.id,
      context.membership.id,
    );
    const queueFilter = workerQueueTabs.find((tab) => tab === params.queue) ?? "active";

    const sortedAssignedOrders = [...assignedOrders].sort((left, right) =>
      compareByAttention(left, right, now),
    );

    const queueCounts = {
      active: sortedAssignedOrders.filter((order) => isOpenStatus(order.status)).length,
      in_progress: sortedAssignedOrders.filter((order) => order.status === "in_progress").length,
      completed: sortedAssignedOrders.filter((order) => order.status === "completed").length,
      cancelled: sortedAssignedOrders.filter((order) => order.status === "cancelled").length,
      all: sortedAssignedOrders.length,
    };

    const filteredOrders = sortedAssignedOrders.filter((order) => {
      if (queueFilter === "active") {
        return isOpenStatus(order.status);
      }
      if (queueFilter === "in_progress") {
        return order.status === "in_progress";
      }
      if (queueFilter === "completed") {
        return order.status === "completed";
      }
      if (queueFilter === "cancelled") {
        return order.status === "cancelled";
      }

      return true;
    });

    const nextPriorityOrder = sortedAssignedOrders.find((order) => isOpenStatus(order.status));

    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Work Orders"
          title="Assigned Work"
          description="Prioritized queue for today, with overdue and urgent work surfaced first."
        />

        {nextPriorityOrder ? (
          <Card>
            <CardContent className="space-y-2 py-5">
              <p className="text-xs uppercase tracking-[0.08em] text-foreground-muted">Do next</p>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">{nextPriorityOrder.title}</CardTitle>
                {isOverdue(nextPriorityOrder, now) ? <Badge variant="danger">Overdue</Badge> : null}
                {!isOverdue(nextPriorityOrder, now) && isUrgent(nextPriorityOrder, now) ? (
                  <Badge variant="warning">Urgent</Badge>
                ) : null}
              </div>
              <p className="text-sm text-foreground-muted">
                Due: {formatDueState(nextPriorityOrder, context.user.timeZone, now)}
              </p>
            </CardContent>
          </Card>
        ) : null}

        <div className="flex flex-wrap gap-2 text-sm">
          {workerQueueTabs.map((tab) => (
            <Link
              key={tab}
              href={`/app/work-orders?queue=${tab}`}
              className={cn(
                "rounded-full border px-3 py-1.5",
                queueFilter === tab
                  ? "bg-accent text-white"
                  : "bg-surface-strong text-foreground-muted hover:bg-accent-soft",
              )}
            >
              {formatQueueLabel(tab)} ({queueCounts[tab]})
            </Link>
          ))}
        </div>

        {filteredOrders.length ? (
          <div className="grid gap-4">
            {filteredOrders.map((order) => (
              <Card key={order.id}>
                <CardContent className="space-y-2 py-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">{order.title}</CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={statusVariant(order.status)}>{formatStatus(order.status)}</Badge>
                      <Badge variant={reviewVariant(order.completionReviewStatus)}>
                        {formatReviewStatus(order.completionReviewStatus)}
                      </Badge>
                      {isOverdue(order, now) ? <Badge variant="danger">Overdue</Badge> : null}
                      {!isOverdue(order, now) && isDueSoon(order, now) ? (
                        <Badge variant="warning">Due soon</Badge>
                      ) : null}
                      {!isOverdue(order, now) && isUrgent(order, now) ? (
                        <Badge variant="warning">Urgent</Badge>
                      ) : null}
                      {order.templateId ? <Badge variant="neutral">Recurring</Badge> : null}
                    </div>
                  </div>
                  <CardDescription>{order.description ?? "No details provided yet."}</CardDescription>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-foreground-muted">
                    <span>Priority: {order.priority}</span>
                    <span>Due: {formatDueState(order, context.user.timeZone, now)}</span>
                    <span>Pay: {formatCompensation(order)}</span>
                    <span>
                      Incentive: {order.incentivePayCents > 0 ? formatMoney(order.incentivePayCents) : "Not set"}
                    </span>
                    {order.generatedForDate ? (
                      <span>Generated for: {formatDateKey(order.generatedForDate, context.user.timeZone)}</span>
                    ) : null}
                  </div>
                  {order.status === "cancelled" && order.cancellationReason ? (
                    <p className="rounded-xl border bg-warning/10 px-3 py-2 text-xs text-warning">
                      Void reason: {order.cancellationReason}
                    </p>
                  ) : null}
                  <IncentiveCountdown
                    incentivePayCents={order.incentivePayCents}
                    incentiveEndsAt={order.incentiveEndsAt}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No work orders in this queue"
            description="Switch queue tabs to see in-progress, completed, or cancelled assignments."
            icon={<ClipboardList className="h-5 w-5 text-accent" />}
          />
        )}
      </div>
    );
  }

  const statusFilter = statusTabs.find((status) => status === params.status) ?? "all";
  const search = params.q?.trim() ?? "";
  const workOrderResult = params.workOrderResult;
  const workOrderMessage = params.workOrderMessage?.trim() ?? "";
  const templateResult = params.templateResult;
  const templateMessage = params.templateMessage?.trim() ?? "";

  const [workOrders, members, templates] = await Promise.all([
    getWorkOrdersForRanch(context.ranch.id, {
      status: statusFilter,
      search,
    }),
    getAssignableMembersForRanch(context.ranch.id),
    getWorkOrderTemplatesForRanch(context.ranch.id),
  ]);
  const pendingReviewOrders = workOrders.filter(
    (order) => order.completionReviewStatus === "pending",
  );
  const overdueCount = workOrders.filter((order) => isOverdue(order, now)).length;
  const urgentCount = workOrders.filter((order) => isUrgent(order, now)).length;
  const prioritizedWorkOrders = [...workOrders].sort((left, right) =>
    compareByAttention(left, right, now),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Work Orders"
        title="Work Order Queue"
        description="Create, assign, and track work with clear status ownership."
      />
      {workOrderMessage ? (
        <p
          className={cn(
            "rounded-xl border px-4 py-3 text-sm",
            workOrderResult === "error"
              ? "border-danger/40 bg-danger/10 text-danger"
              : "border-accent/40 bg-accent-soft text-accent",
          )}
        >
          {workOrderMessage}
        </p>
      ) : null}
      {templateMessage ? (
        <p
          className={cn(
            "rounded-xl border px-4 py-3 text-sm",
            templateResult === "error"
              ? "border-danger/40 bg-danger/10 text-danger"
              : "border-accent/40 bg-accent-soft text-accent",
          )}
        >
          {templateMessage}
        </p>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="space-y-1 py-5">
            <p className="text-xs uppercase tracking-[0.08em] text-foreground-muted">Open Queue</p>
            <p className="text-2xl font-semibold">
              {workOrders.filter((order) => isOpenStatus(order.status)).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 py-5">
            <p className="text-xs uppercase tracking-[0.08em] text-foreground-muted">Overdue</p>
            <p className="text-2xl font-semibold text-danger">{overdueCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 py-5">
            <p className="text-xs uppercase tracking-[0.08em] text-foreground-muted">Urgent</p>
            <p className="text-2xl font-semibold text-warning">{urgentCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 py-5">
            <p className="text-xs uppercase tracking-[0.08em] text-foreground-muted">Pending Review</p>
            <p className="text-2xl font-semibold">{pendingReviewOrders.length}</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardContent className="space-y-4 py-6">
          <div>
            <CardTitle className="text-base">Create work order</CardTitle>
            <CardDescription>
              Use a focused status model: draft, open, in progress, completed. Use &quot;Void
              mistaken work order&quot; from detail pages when cleanup is needed.
            </CardDescription>
          </div>
          <CreateWorkOrderForm members={members} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 py-6">
          <div>
            <CardTitle className="text-base">Template Library & Recurring Work</CardTitle>
            <CardDescription>
              Save repeatable tasks once, generate on demand, and optionally keep them recurring.
            </CardDescription>
          </div>
          <CreateWorkOrderTemplateForm members={members} />
          <div className="h-px bg-border" />
          {templates.length ? (
            <div className="space-y-3">
              {templates.map((template) => (
                <div key={template.id} className="rounded-xl border bg-surface p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-1">
                      <p className="font-semibold">
                        {template.templateName}: {template.title}
                      </p>
                      <p className="text-xs text-foreground-muted">
                        {template.description ?? "No template description."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={template.isActive ? "success" : "neutral"}>
                        {template.isActive ? "active" : "paused"}
                      </Badge>
                      <Badge variant={template.recurringEnabled ? "warning" : "neutral"}>
                        {template.recurringEnabled ? "recurring" : "manual"}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground-muted">
                    <span>Priority: {template.priority}</span>
                    <span>Pay: {formatCompensation(template)}</span>
                    <span>Incentive: {formatMoney(template.incentivePayCents)}</span>
                    <span>{formatRecurrenceLabel(template)}</span>
                  </div>
                  <p className="mt-2 text-xs text-foreground-muted">
                    Default assignees:{" "}
                    {template.assignees.length
                      ? template.assignees.map((member) => member.fullName).join(", ")
                      : "none"}
                  </p>

                  <div className="mt-3 grid gap-3 lg:grid-cols-[auto_1fr]">
                    <form action={createWorkOrderFromTemplateFormAction}>
                      <input type="hidden" name="templateId" value={template.id} />
                      <button
                        type="submit"
                        className="h-9 rounded-xl border bg-surface-strong px-3 text-xs font-semibold hover:bg-accent-soft"
                      >
                        Create now
                      </button>
                    </form>

                    <form
                      action={updateWorkOrderTemplateRecurrenceFormAction}
                      className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5"
                    >
                      <input type="hidden" name="templateId" value={template.id} />
                      <label className="flex items-center gap-2 rounded-xl border bg-surface-strong px-3 py-2 text-xs">
                        <input
                          type="checkbox"
                          name="isActive"
                          defaultChecked={template.isActive}
                        />
                        Active
                      </label>
                      <label className="flex items-center gap-2 rounded-xl border bg-surface-strong px-3 py-2 text-xs">
                        <input
                          type="checkbox"
                          name="recurringEnabled"
                          defaultChecked={template.recurringEnabled}
                        />
                        Recurring
                      </label>
                      <select
                        name="recurrenceCadence"
                        defaultValue={template.recurrenceCadence ?? ""}
                        className="h-9 rounded-xl border bg-surface-strong px-3 text-xs"
                      >
                        <option value="">Cadence</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="custom">Custom</option>
                      </select>
                      <input
                        name="recurrenceIntervalDays"
                        type="number"
                        min="1"
                        defaultValue={template.recurrenceIntervalDays ?? ""}
                        placeholder="Custom days"
                        className="h-9 rounded-xl border bg-surface-strong px-3 text-xs"
                      />
                      <div className="flex gap-2">
                        <input
                          name="nextGenerationOn"
                          type="date"
                          defaultValue={template.nextGenerationOn ?? ""}
                          className="h-9 w-full rounded-xl border bg-surface-strong px-3 text-xs"
                        />
                        <button
                          type="submit"
                          className="h-9 rounded-xl border bg-surface-strong px-3 text-xs font-semibold hover:bg-accent-soft"
                        >
                          Save
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-foreground-muted">
              No templates yet. Save your first recurring task above.
            </p>
          )}
        </CardContent>
      </Card>

      {pendingReviewOrders.length ? (
        <Card>
          <CardContent className="space-y-4 py-6">
            <div>
              <CardTitle className="text-base">Needs Manager Review</CardTitle>
              <CardDescription>
                Crew-completed work orders waiting on inspection and sign-off.
              </CardDescription>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {pendingReviewOrders.slice(0, 6).map((order) => (
                <Link
                  key={order.id}
                  href={`/app/work-orders/${order.id}`}
                  className="rounded-xl border bg-surface p-3 hover:bg-accent-soft/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{order.title}</span>
                    <Badge variant="warning">Review pending</Badge>
                  </div>
                  <p className="mt-1 text-sm text-foreground-muted">
                    {order.assignees.length
                      ? order.assignees.map((assignee) => assignee.fullName).join(", ")
                      : "No assignees listed"}
                  </p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2 text-sm">
            {statusTabs.map((status) => (
              <Link
                key={status}
                href={`/app/work-orders?status=${status}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
                className={cn(
                  "rounded-full border px-3 py-1.5",
                  statusFilter === status
                    ? "bg-accent text-white"
                    : "bg-surface-strong text-foreground-muted hover:bg-accent-soft",
                )}
              >
                {formatStatus(status)}
              </Link>
            ))}
          </div>
          <form className="flex items-center gap-2">
            <input
              name="q"
              defaultValue={search}
              placeholder="Search title..."
              className="h-9 rounded-xl border bg-surface px-3 text-sm"
            />
            <input type="hidden" name="status" value={statusFilter} />
            <button
              type="submit"
              className="h-9 rounded-xl border bg-surface-strong px-3 text-sm font-semibold hover:bg-accent-soft"
            >
              Search
            </button>
          </form>
        </div>

        {prioritizedWorkOrders.length ? (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Title</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Priority</TableHeaderCell>
                  <TableHeaderCell>Assignees</TableHeaderCell>
                  <TableHeaderCell>Due</TableHeaderCell>
                  <TableHeaderCell>Pay</TableHeaderCell>
                  <TableHeaderCell>Review</TableHeaderCell>
                  <TableHeaderCell>Incentive</TableHeaderCell>
                  <TableHeaderCell className="text-right">Actions</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {prioritizedWorkOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p>{order.title}</p>
                        <div className="flex flex-wrap gap-1">
                          {order.templateId ? <Badge variant="neutral">Recurring</Badge> : null}
                          {order.generatedForDate ? (
                            <Badge variant="neutral">
                              Generated {formatDateKey(order.generatedForDate, context.user.timeZone)}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={statusVariant(order.status)}>{formatStatus(order.status)}</Badge>
                        {isOverdue(order, now) ? <Badge variant="danger">Overdue</Badge> : null}
                        {!isOverdue(order, now) && isDueSoon(order, now) ? (
                          <Badge variant="warning">Due soon</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        <span>{order.priority}</span>
                        {isUrgent(order, now) ? <Badge variant="warning">Urgent</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {order.assignees.length
                        ? order.assignees.map((assignee) => assignee.fullName).join(", ")
                        : "Unassigned"}
                    </TableCell>
                    <TableCell>{formatDueState(order, context.user.timeZone, now)}</TableCell>
                    <TableCell>{formatCompensation(order)}</TableCell>
                    <TableCell>
                      <Badge variant={reviewVariant(order.completionReviewStatus)}>
                        {formatReviewStatus(order.completionReviewStatus)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <IncentiveCountdown
                        incentivePayCents={order.incentivePayCents}
                        incentiveEndsAt={order.incentiveEndsAt}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/app/work-orders/${order.id}`}
                        className="rounded-lg border px-2.5 py-1 text-xs font-semibold text-foreground-muted hover:bg-accent-soft hover:text-foreground"
                      >
                        Edit
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <EmptyState
            title="No work orders in this view"
            description="Create a work order or adjust filters to view existing records."
            icon={<ClipboardList className="h-5 w-5 text-accent" />}
          />
        )}
      </section>
    </div>
  );
}
