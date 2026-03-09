import { HandCoins } from "lucide-react";
import { EmptyState } from "@/components/patterns/empty-state";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTableShell } from "@/components/patterns/data-table-shell";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/context";

export default async function PayrollPage() {
  await requireRole(["owner", "manager"]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Payroll"
        title="Payroll Summary"
        description="Review period totals and export payroll-ready records with clear pay visibility."
        actions={<Button variant="secondary">Export CSV</Button>}
      />
      <DataTableShell
        columns={["Team Member", "Hours", "Pay Type", "Pay Rate", "Estimated Pay"]}
        emptyLabel="No payroll summary data yet."
      />
      <EmptyState
        title="Payroll summary will appear here"
        description="As time is tracked, this page will provide clear totals and export options."
        icon={<HandCoins className="h-5 w-5 text-accent" />}
      />
    </div>
  );
}
