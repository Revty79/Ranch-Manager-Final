import Link from "next/link";
import { EmptyState } from "@/components/patterns/empty-state";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionHeader } from "@/components/patterns/section-header";
import { StatCard } from "@/components/patterns/stat-card";
import { DataTableShell } from "@/components/patterns/data-table-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { ClipboardList } from "lucide-react";
import { requirePaidAccessContext } from "@/lib/auth/context";
import { cn } from "@/lib/utils";

export default async function AppHomePage() {
  await requirePaidAccessContext();

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
        <StatCard label="Active Crew" value="0" trend="Ready for first team setup" />
        <StatCard label="Open Work Orders" value="0" trend="No backlog yet" />
        <StatCard label="Active Shifts" value="0" trend="Clock starts on first shift" />
        <StatCard label="Payroll This Period" value="$0.00" trend="Will populate from tracked time" />
      </section>

      <section>
        <SectionHeader
          title="Recent Work"
          description="Work-order activity will appear here as soon as your team starts using the system."
        />
        <DataTableShell
          columns={["Work Order", "Assigned", "Due", "Status"]}
          rows={[
            ["Water Line Inspection", "Unassigned", "Not set", "status: draft"],
            ["North Fence Repair", "No crew", "Not set", "status: open"],
          ]}
        />
      </section>

      <EmptyState
        title="No live activity yet"
        description="Create your first work order, add team members, and start tracking time to populate this dashboard."
        icon={<ClipboardList className="h-5 w-5 text-accent" />}
        action={<Button variant="secondary">View setup checklist</Button>}
      />
    </div>
  );
}
