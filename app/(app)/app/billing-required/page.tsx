import { BillingRequiredShell } from "@/components/patterns/access-states";
import { PageHeader } from "@/components/patterns/page-header";

export default function AppBillingRequiredPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Billing"
        title="Subscription required"
        description="Activate billing or use beta lifetime access to continue into paid product routes."
      />
      <BillingRequiredShell />
    </div>
  );
}
