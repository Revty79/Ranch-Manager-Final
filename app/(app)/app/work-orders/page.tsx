import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { CreateWorkOrderForm } from "@/components/work-orders/create-work-order-form";
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
import { requirePaidAccessContext } from "@/lib/auth/context";
import {
  getAssignedWorkForMembership,
  getAssignableMembersForRanch,
  getWorkOrdersForRanch,
} from "@/lib/work-orders/queries";
import { cn } from "@/lib/utils";

const statusTabs = ["all", "draft", "open", "in_progress", "completed", "cancelled"] as const;
const workerRoles = new Set(["worker", "seasonal_worker"]);

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

function formatDate(value: Date | null): string {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function formatStatus(status: string): string {
  return status.replace("_", " ");
}

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const context = await requirePaidAccessContext();
  const params = await searchParams;

  if (workerRoles.has(context.membership.role)) {
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
                    <Badge variant={statusVariant(order.status)}>
                      {formatStatus(order.status)}
                    </Badge>
                  </div>
                  <CardDescription>{order.description ?? "No details provided yet."}</CardDescription>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-foreground-muted">
                    <span>Priority: {order.priority}</span>
                    <span>Due: {formatDate(order.dueAt)}</span>
                  </div>
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

  const [workOrders, members] = await Promise.all([
    getWorkOrdersForRanch(context.ranch.id, {
      status: statusFilter,
      search,
    }),
    getAssignableMembersForRanch(context.ranch.id),
  ]);

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
                    <TableCell>{formatDate(order.dueAt)}</TableCell>
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
