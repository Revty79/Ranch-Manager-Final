import { BillingRequiredShell } from "@/components/patterns/access-states";

export default function BillingRequiredPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 py-6">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
        Access State
      </p>
      <BillingRequiredShell />
    </div>
  );
}
