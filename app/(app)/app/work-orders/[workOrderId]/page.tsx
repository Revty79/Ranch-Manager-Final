import Link from "next/link";
import { notFound } from "next/navigation";
import { EditWorkOrderForm } from "@/components/work-orders/edit-work-order-form";
import { PageHeader } from "@/components/patterns/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/context";
import {
  getAssignableMembersForRanch,
  getWorkOrderById,
} from "@/lib/work-orders/queries";

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
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{workOrder.priority}</Badge>
            <Badge variant="neutral">{workOrder.status.replace("_", " ")}</Badge>
          </div>
          <EditWorkOrderForm workOrder={workOrder} members={members} />
        </CardContent>
      </Card>
    </div>
  );
}
