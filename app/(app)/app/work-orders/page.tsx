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
  createWorkOrderFromTemplateAction,
  updateWorkOrderTemplateRecurrenceAction,
} from "@/lib/work-orders/actions";
import { materializeDueRecurringWorkOrdersForRanch } from "@/lib/work-orders/maintenance";
import {
  getAssignedWorkForMembership,
  getAssignableMembersForRanch,
  getWorkOrderTemplatesForRanch,
  getWorkOrdersForRanch,
} from "@/lib/work-orders/queries";
import { cn } from "@/lib/utils";

const statusTabs = ["all", "draft", "open", "in_progress", "completed", "cancelled"] as const;
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
    return `Every ${interval} day${interval === 1 ? "" : "s"} · next ${template.nextGenerationOn ?? "not set"}`;
  }

  return `${template.recurrenceCadence ?? "unknown cadence"} · next ${template.nextGenerationOn ?? "not set"}`;
}

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const context = await requireSectionAccess("workOrders");
  const canManageWorkOrders = hasSectionAccess(
    context.membership.sectionAccess,
    "workOrders",
    "manage",
  );
  await materializeDueRecurringWorkOrdersForRanch(context.ranch.id);
  const params = await searchParams;

  if (!canManageWorkOrders) {
    const assignedOrders = await getAssignedWorkForMembership(
      context.ranch.id,
      context.membership.id,
    );

    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Work Orders"
          title="Assigned Work"
          description="Your active and recent assigned work orders."
        />
        {assignedOrders.length ? (
          <div className="grid gap-4">
            {assignedOrders.map((order) => (
              <Card key={order.id}>
                <CardContent className="space-y-2 py-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">{order.title}</CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={statusVariant(order.status)}>
                        {formatStatus(order.status)}
                      </Badge>
                      <Badge variant={reviewVariant(order.completionReviewStatus)}>
                        {formatReviewStatus(order.completionReviewStatus)}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription>{order.description ?? "No details provided yet."}</CardDescription>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-foreground-muted">
                    <span>Priority: {order.priority}</span>
                    <span>Due: {formatDate(order.dueAt, context.user.timeZone)}</span>
                    <span>Pay: {formatCompensation(order)}</span>
                    <span>
                      Incentive:{" "}
                      {order.incentivePayCents > 0
                        ? formatMoney(order.incentivePayCents)
                        : "Not set"}
                    </span>
                  </div>
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
            title="No assigned work yet"
            description="Once a manager assigns work orders to you, they will appear here."
            icon={<ClipboardList className="h-5 w-5 text-accent" />}
          />
        )}
      </div>
    );
  }

  const statusFilter =
    statusTabs.find((status) => status === params.status) ?? "all";
  const search = params.q?.trim() ?? "";

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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Work Orders"
        title="Work Order Queue"
        description="Create, assign, and track work with clear status ownership."
      />

      <Card>
        <CardContent className="space-y-4 py-6">
          <div>
            <CardTitle className="text-base">Create work order</CardTitle>
            <CardDescription>
              Use a focused status model: draft, open, in progress, completed, cancelled.
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
                    <form action={createWorkOrderFromTemplateAction}>
                      <input type="hidden" name="templateId" value={template.id} />
                      <button
                        type="submit"
                        className="h-9 rounded-xl border bg-surface-strong px-3 text-xs font-semibold hover:bg-accent-soft"
                      >
                        Create now
                      </button>
                    </form>

                    <form
                      action={updateWorkOrderTemplateRecurrenceAction}
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

        {workOrders.length ? (
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
                {workOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>{order.title}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(order.status)}>
                        {formatStatus(order.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{order.priority}</TableCell>
                    <TableCell>
                      {order.assignees.length
                        ? order.assignees.map((assignee) => assignee.fullName).join(", ")
                        : "Unassigned"}
                    </TableCell>
                    <TableCell>{formatDate(order.dueAt, context.user.timeZone)}</TableCell>
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
