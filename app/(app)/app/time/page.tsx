import { Clock3 } from "lucide-react";
import { EmptyState } from "@/components/patterns/empty-state";
import { PageHeader } from "@/components/patterns/page-header";
import { StatCard } from "@/components/patterns/stat-card";
import { Button } from "@/components/ui/button";

export default function TimePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Time"
        title="Shift & Task Time"
        description="Track shift state, active work, and recent time history with clear guardrails."
      />
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Current Shift" value="Not started" />
        <StatCard label="Active Work Order" value="None" />
        <StatCard label="Tracked Hours Today" value="0.0h" />
      </section>
      <EmptyState
        title="No time entries yet"
        description="Workers can start shifts and clock into assigned work orders from this area."
        icon={<Clock3 className="h-5 w-5 text-accent" />}
        action={<Button variant="secondary">Start a shift</Button>}
      />
    </div>
  );
}
