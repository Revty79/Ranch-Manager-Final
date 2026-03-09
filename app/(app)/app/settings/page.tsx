import Link from "next/link";
import { AccessDeniedShell, BillingRequiredShell } from "@/components/patterns/access-states";
import { PageHeader } from "@/components/patterns/page-header";
import { CouponCodeForm } from "@/components/billing/beta-code-form";
import { CheckoutForm } from "@/components/billing/checkout-form";
import { requireAppContext } from "@/lib/auth/context";
import { hasBillingAccess } from "@/lib/billing/access";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";

function formatDate(value: Date | null): string {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const context = await requireAppContext();
  const billingQueryState = (await searchParams).billing;
  const isOwner = context.membership.role === "owner";
  const billingAccess = hasBillingAccess(context.ranch);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Account & Billing"
        description="Ranch identity, role context, and subscription access state."
      />

      {billingQueryState === "success" ? (
        <p className="rounded-xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-accent">
          Stripe checkout completed. Subscription state will refresh after webhook sync.
        </p>
      ) : null}
      {billingQueryState === "cancel" ? (
        <p className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          Checkout was canceled. You can retry when ready.
        </p>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 py-6">
            <CardTitle>Ranch Profile</CardTitle>
            <CardDescription>Core tenant context for this workspace.</CardDescription>
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

        <Card>
          <CardContent className="space-y-3 py-6">
            <CardTitle>Subscription Access</CardTitle>
            <CardDescription>
              Paid access is required for core app routes unless beta lifetime access is enabled.
            </CardDescription>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-foreground-muted">Access state:</span>{" "}
                <Badge variant={billingAccess ? "success" : "warning"}>
                  {billingAccess ? "Access enabled" : "Billing required"}
                </Badge>
              </p>
              <p>
                <span className="text-foreground-muted">Subscription status:</span>{" "}
                {context.ranch.subscriptionStatus}
              </p>
              <p>
                <span className="text-foreground-muted">Plan:</span>{" "}
                {context.ranch.subscriptionPlanKey ?? "Launch Plan"}
              </p>
              <p>
                <span className="text-foreground-muted">Current period end:</span>{" "}
                {formatDate(context.ranch.subscriptionCurrentPeriodEnd)}
              </p>
              <p>
                <span className="text-foreground-muted">Beta lifetime access:</span>{" "}
                {context.ranch.betaLifetimeAccess ? "Enabled" : "Not enabled"}
              </p>
            </div>
            {isOwner ? (
              <div className="space-y-3 pt-2">
                <CheckoutForm />
                <details className="rounded-xl border bg-surface p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-foreground">
                    Have a coupon code?
                  </summary>
                  <div className="pt-3">
                    <CouponCodeForm />
                  </div>
                </details>
              </div>
            ) : (
              <p className="text-sm text-foreground-muted">
                Billing controls are owner-only.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <AccessDeniedShell />
        <BillingRequiredShell />
      </section>

      <Card>
        <CardContent className="space-y-3 py-6">
          <CardTitle className="text-base">State route previews</CardTitle>
          <CardDescription className="text-sm">
            Branded access-state routes for product messaging and safeguards.
          </CardDescription>
          <div className="flex flex-wrap gap-3 text-sm text-accent">
            <Link href="/app/access-denied">/app/access-denied</Link>
            <Link href="/app/billing-required">/app/billing-required</Link>
            <Link href="/billing-required">/billing-required</Link>
            <Link href="/no-ranch-access">/no-ranch-access</Link>
            <Link href="/onboarding-incomplete">/onboarding-incomplete</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
