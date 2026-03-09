import { AccessDeniedShell } from "@/components/patterns/access-states";
import { PageHeader } from "@/components/patterns/page-header";

export default function AccessDeniedPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Access"
        title="You do not have access to this area"
        description="This route is restricted by role. Contact your ranch owner if access should be updated."
      />
      <AccessDeniedShell />
    </div>
  );
}
