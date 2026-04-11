import Link from "next/link";
import { notFound } from "next/navigation";
import { CompletionReviewPanel } from "@/components/work-orders/completion-review-panel";
import { EditWorkOrderForm } from "@/components/work-orders/edit-work-order-form";
import { IncentiveCountdown } from "@/components/work-orders/incentive-countdown";
import { PageHeader } from "@/components/patterns/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/context";
import {
  getAssignableMembersForRanch,
  getWorkOrderById,
} from "@/lib/work-orders/queries";

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatReviewStatus(status: "pending" | "approved" | "changes_requested" | null): string {
  if (!status) {
    return "No manager review";
  }

  if (status === "changes_requested") {
    return "Changes requested";
  }

  return `Review ${status}`;
}

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ workOrderId: string }>;
}) {
  const context = await requireRole(["owner", "manager"]);
  const { workOrderId } = await params;

  const [workOrder, members] = await Promise.all([
    getWorkOrderById(context.ranch.id, workOrderId),
    getAssignableMembersForRanch(context.ranch.id),
  ]);

  if (!workOrder) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Work Order Detail"
        title={workOrder.title}
        description="Edit details, assignees, and status for this work order."
        actions={
          <Link
            href="/app/work-orders"
            className="rounded-xl border bg-surface px-3 py-2 text-sm font-semibold text-foreground-muted hover:bg-accent-soft hover:text-foreground"
          >
            Back to work orders
          </Link>
        }
      />

      <Card>
        <CardContent className="space-y-5 py-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="neutral">{workOrder.priority}</Badge>
              <Badge variant="neutral">{workOrder.status.replace("_", " ")}</Badge>
              <Badge variant="neutral">{formatReviewStatus(workOrder.completionReviewStatus)}</Badge>
              <Badge variant="neutral">
                {workOrder.compensationType === "flat_amount"
                  ? `Flat pay ${formatMoney(workOrder.flatPayCents)}`
                  : "Regular pay"}
              </Badge>
              <Badge variant="neutral">
                {workOrder.incentivePayCents > 0
                  ? `Incentive ${formatMoney(workOrder.incentivePayCents)}`
                  : "No incentive"}
              </Badge>
            </div>
            <IncentiveCountdown
              incentivePayCents={workOrder.incentivePayCents}
              incentiveEndsAt={workOrder.incentiveEndsAt}
            />
          </div>
          <EditWorkOrderForm workOrder={workOrder} members={members} />
        </CardContent>
      </Card>

      {workOrder.completionReview ? (
        <CompletionReviewPanel
          workOrderId={workOrder.id}
          review={workOrder.completionReview}
          timeZone={context.user.timeZone}
        />
      ) : null}
    </div>
  );
}
