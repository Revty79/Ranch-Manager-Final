import { ClipboardList } from "lucide-react";
import { DataTableShell } from "@/components/patterns/data-table-shell";
import { EmptyState } from "@/components/patterns/empty-state";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";

export default function WorkOrdersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Work Orders"
        title="Work Order Queue"
        description="Create, assign, and monitor operational work with a clear status workflow."
        actions={<Button>Create work order</Button>}
      />
      <DataTableShell
        columns={["ID", "Title", "Assignees", "Priority", "Status"]}
        emptyLabel="No work orders yet."
      />
      <EmptyState
        title="No work orders created"
        description="Once work orders are created, your team and status flow will appear here."
        icon={<ClipboardList className="h-5 w-5 text-accent" />}
      />
    </div>
  );
}
