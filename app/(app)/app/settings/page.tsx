import { AccessDeniedShell, BillingRequiredShell } from "@/components/patterns/access-states";
import { ConfirmationDialogShell } from "@/components/patterns/confirmation-dialog-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { requireAppContext } from "@/lib/auth/context";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function SettingsPage() {
  const context = await requireAppContext();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Account & Access"
        description="Current ranch context and state shell previews for upcoming workflows."
      />

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 py-6">
            <CardTitle>Ranch Profile</CardTitle>
            <CardDescription>Core tenant information used throughout the app.</CardDescription>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-foreground-muted">Ranch:</span> {context.ranch.name}
              </p>
              <p>
                <span className="text-foreground-muted">Current user:</span>{" "}
                {context.user.fullName}
              </p>
              <p>
                <span className="text-foreground-muted">Role:</span>{" "}
                <Badge variant="success">{context.membership.role}</Badge>
              </p>
            </div>
          </CardContent>
        </Card>
        <ConfirmationDialogShell
          title="Deactivate member?"
          description="This shell is ready for future confirmation flows around team and billing settings."
          confirmLabel="Deactivate"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <AccessDeniedShell />
        <BillingRequiredShell />
      </section>

      <Card>
        <CardContent className="space-y-3 py-6">
          <CardTitle className="text-base">State route previews</CardTitle>
          <CardDescription className="text-sm">
            Branded access-state routes available for product messaging and future guards.
          </CardDescription>
          <div className="flex flex-wrap gap-3 text-sm text-accent">
            <Link href="/app/access-denied">/app/access-denied</Link>
            <Link href="/billing-required">/billing-required</Link>
            <Link href="/no-ranch-access">/no-ranch-access</Link>
            <Link href="/onboarding-incomplete">/onboarding-incomplete</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
