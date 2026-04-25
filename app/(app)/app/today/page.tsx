import Link from "next/link";
import { TimeControlPanel } from "@/components/time/time-control-panel";
import { EmptyState } from "@/components/patterns/empty-state";
import { PageHeader } from "@/components/patterns/page-header";
import { StatCard } from "@/components/patterns/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { hasSectionAccess } from "@/lib/auth/capabilities";
import { requireSectionAccess } from "@/lib/auth/context";
import {
  getPrivateMessagingWorkspace,
  getRanchMessageThreads,
} from "@/lib/communication/queries";
import {
  getActiveShiftForMembership,
  getActiveWorkSessionForMembership,
  getWorkOrderOptionsForTimeTracking,
} from "@/lib/time/queries";
import { getAssignedWorkForMembership } from "@/lib/work-orders/queries";

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
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(value);
}

function formatStatus(value: string): string {
  return value.replace("_", " ");
}

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

function reviewLabel(status: "pending" | "approved" | "changes_requested" | null): string {
  if (!status) {
    return "No review";
  }
  if (status === "changes_requested") {
    return "Changes requested";
  }
  return `Review ${status}`;
}

function resolveNextAction(params: {
  activeWorkTitle: string | null;
  hasActiveShift: boolean;
  isShiftPaused: boolean;
  isPieceWork: boolean;
  availableWorkCount: number;
  assignedOpenCount: number;
}): string {
  if (params.activeWorkTitle) {
    return `Finish or stop the active timer on "${params.activeWorkTitle}".`;
  }

  if (!params.isPieceWork && !params.hasActiveShift) {
    return "Clock in to start your shift, then start your first work timer.";
  }

  if (params.isShiftPaused) {
    return "Clock out of the paused shift, then clock back in when you are ready to continue.";
  }

  if (params.availableWorkCount > 0) {
    return "Start your next assigned work timer from the control panel below.";
  }

  if (params.assignedOpenCount > 0) {
    return "Complete one of your assigned flat-amount work orders.";
  }

  return "Check communication for urgent updates while waiting on new assignments.";
}

export default async function WorkerTodayPage() {
  const context = await requireSectionAccess("today");
  const canManageTime = hasSectionAccess(context.membership.sectionAccess, "time", "manage");
  const canViewCommunication = hasSectionAccess(
    context.membership.sectionAccess,
    "communication",
    "view",
  );
  const canViewWorkOrders = hasSectionAccess(
    context.membership.sectionAccess,
    "workOrders",
    "view",
  );
  const [activeShift, activeWork, workOrderOptions, assignedWork, threads, privateWorkspace] =
    await Promise.all([
      getActiveShiftForMembership(context.ranch.id, context.membership.id),
      getActiveWorkSessionForMembership(context.ranch.id, context.membership.id),
      getWorkOrderOptionsForTimeTracking(
        context.ranch.id,
        context.membership.id,
        context.membership.role,
      ),
      getAssignedWorkForMembership(context.ranch.id, context.membership.id),
      getRanchMessageThreads(context.ranch.id, { archiveView: "active" }),
      getPrivateMessagingWorkspace({
        ranchId: context.ranch.id,
        currentMembershipId: context.membership.id,
      }),
    ]);

  const assignedOpenWork = assignedWork.filter(
    (order) => order.status !== "completed" && order.status !== "cancelled",
  );
  const urgentThreads = threads.filter((thread) => thread.priority === "urgent").slice(0, 6);
  const isPieceWork = context.membership.payType === "piece_work";
  const nextAction = resolveNextAction({
    activeWorkTitle: activeWork?.workOrderTitle ?? null,
    hasActiveShift: Boolean(activeShift),
    isShiftPaused: Boolean(activeShift?.pausedAt),
    isPieceWork,
    availableWorkCount: workOrderOptions.length,
    assignedOpenCount: assignedOpenWork.length,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Worker Today"
        title="Today"
        description="Your shift state, current work, and next action in one place."
        actions={
          <div className="flex flex-wrap gap-2">
            {canViewCommunication ? (
              <Link
                href="/app/communication"
                className="rounded-xl border bg-surface px-3 py-2 text-sm font-semibold text-foreground-muted hover:bg-accent-soft hover:text-foreground"
              >
                Open Communication
              </Link>
            ) : null}
            {canViewWorkOrders ? (
              <Link
                href="/app/work-orders"
                className="rounded-xl border bg-surface px-3 py-2 text-sm font-semibold text-foreground-muted hover:bg-accent-soft hover:text-foreground"
              >
                Open Work Orders
              </Link>
            ) : null}
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Shift"
          value={
            isPieceWork
              ? activeShift
                ? "Legacy active"
                : "Not required"
              : activeShift
                ? activeShift.pausedAt
                  ? "Paused"
                  : "Active"
                : "Not started"
          }
          trend={
            activeShift
              ? `Since ${formatDateTime(activeShift.startedAt, context.user.timeZone)}`
              : undefined
          }
        />
        <StatCard
          label="Active Work Timer"
          value={activeWork ? activeWork.workOrderTitle : "None"}
          trend={activeWork ? `Started ${formatDateTime(activeWork.startedAt, context.user.timeZone)}` : undefined}
        />
        <StatCard label="Assigned Open Work" value={`${assignedOpenWork.length}`} />
        <StatCard
          label="Urgent/Unread Alerts"
          value={`${urgentThreads.length + privateWorkspace.totalUnreadCount}`}
          trend={`${urgentThreads.length} urgent threads, ${privateWorkspace.totalUnreadCount} unread private`}
        />
      </section>

      <Card>
        <CardContent className="space-y-2 py-6">
          <CardTitle className="text-base">Next best action</CardTitle>
          <CardDescription>{nextAction}</CardDescription>
        </CardContent>
      </Card>

      {canManageTime ? (
        <TimeControlPanel
          activeShift={activeShift}
          activeWork={activeWork}
          workOrderOptions={workOrderOptions}
          payType={context.membership.payType}
          timeZone={context.user.timeZone}
        />
      ) : (
        <Card>
          <CardContent className="py-6">
            <p className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
              Time controls are disabled for your membership right now.
            </p>
          </CardContent>
        </Card>
      )}

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 py-6">
            <div>
              <CardTitle className="text-base">Assigned work</CardTitle>
              <CardDescription>Tasks currently assigned to your membership.</CardDescription>
            </div>
            {assignedOpenWork.length ? (
              <div className="space-y-3">
                {assignedOpenWork.slice(0, 8).map((order) => (
                  <div key={order.id} className="rounded-xl border bg-surface p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{order.title}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={statusVariant(order.status)}>{formatStatus(order.status)}</Badge>
                        <Badge variant={reviewVariant(order.completionReviewStatus)}>
                          {reviewLabel(order.completionReviewStatus)}
                        </Badge>
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-foreground-muted">
                      Due: {formatDate(order.dueAt, context.user.timeZone)}
                    </p>
                    <p className="text-sm text-foreground-muted">
                      Priority: {order.priority}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No assigned work right now"
                description="New assignments will appear here as soon as a manager dispatches them."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 py-6">
            <div>
              <CardTitle className="text-base">Communication alerts</CardTitle>
              <CardDescription>
                Urgent ranch threads plus your unread private messages.
              </CardDescription>
            </div>
            <div className="rounded-xl border bg-surface px-3 py-2">
              <p className="text-sm">
                Unread private messages:{" "}
                <span className="font-semibold">{privateWorkspace.totalUnreadCount}</span>
              </p>
            </div>
            {urgentThreads.length ? (
              <ul className="space-y-2">
                {urgentThreads.map((thread) => (
                  <li key={thread.id} className="rounded-xl border bg-surface px-3 py-2">
                    <p className="font-semibold">{thread.title ?? "Urgent thread"}</p>
                    <p className="text-xs text-foreground-muted">
                      Last activity {formatDateTime(thread.latestActivityAt, context.user.timeZone)}
                    </p>
                    <p className="text-sm text-foreground-muted">{thread.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-foreground-muted">No urgent ranch threads at the moment.</p>
            )}
            <Link
              href="/app/communication"
              className="inline-flex rounded-lg border px-2.5 py-1 text-xs font-semibold text-foreground-muted hover:bg-accent-soft hover:text-foreground"
            >
              Open full communication
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
