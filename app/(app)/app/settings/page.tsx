import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
import { CouponCodeForm } from "@/components/billing/beta-code-form";
import { CheckoutForm } from "@/components/billing/checkout-form";
import { CustomerPortalForm } from "@/components/billing/customer-portal-form";
import { TimeZoneForm } from "@/components/settings/timezone-form";
import { requireAppContext } from "@/lib/auth/context";
import { hasBillingAccess } from "@/lib/billing/access";
import { syncRanchFromCheckoutSession } from "@/lib/billing/stripe-sync";
import { isTrialEligible, resolveTrialConfig } from "@/lib/billing/trial";
import { isPlatformAdminEmail } from "@/lib/auth/platform-admin";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";

const SUPPORT_EMAIL = "brannan.pearson.ranch@gmail.com";

function formatDate(value: Date | null, timeZone: string): string {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(value);
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string; session_id?: string }>;
}) {
  const query = await searchParams;
  const billingQueryState = query.billing;
  const checkoutSessionId = query.session_id;
  let context = await requireAppContext();
  let checkoutSyncError: string | null = null;

  if (
    context.membership.role === "owner" &&
    typeof checkoutSessionId === "string" &&
    (billingQueryState === "success" || billingQueryState === "trial_started")
  ) {
    const syncResult = await syncRanchFromCheckoutSession({
      ranchId: context.ranch.id,
      checkoutSessionId,
    });

    if (!syncResult.ok) {
      checkoutSyncError = syncResult.error ?? "Unable to sync checkout status.";
    } else {
      context = await requireAppContext();
    }
  }

  const isOwner = context.membership.role === "owner";
  const billingAccess = hasBillingAccess(context.ranch);
  const trialConfig = resolveTrialConfig();
  const trialEligible =
    trialConfig.trialDays !== null && isTrialEligible(context.ranch);
  const hasStripeCustomer = Boolean(context.ranch.stripeCustomerId);
  const hasStripeSubscriptionAccess =
    context.ranch.subscriptionStatus === "active" ||
    context.ranch.subscriptionStatus === "trialing";
  const accessSource = context.ranch.betaLifetimeAccess
    ? "Beta lifetime code"
    : context.ranch.subscriptionStatus === "active" ||
        context.ranch.subscriptionStatus === "trialing"
      ? "Stripe subscription"
      : "No active access source";
  const canSeeStatePreviews = isPlatformAdminEmail(context.user.email);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Account & Billing"
        description="Ranch identity, role context, and subscription access state."
      />

      {billingQueryState === "success" ? (
        <p className="rounded-xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-accent">
          Stripe checkout completed. Subscription access is syncing now.
        </p>
      ) : null}
      {billingQueryState === "trial_started" ? (
        <p className="rounded-xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-accent">
          Trial checkout completed. Subscription access is syncing now.
        </p>
      ) : null}
      {billingQueryState === "cancel" ? (
        <p className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          Checkout was canceled. You can retry when ready.
        </p>
      ) : null}
      {billingQueryState === "portal_return" ? (
        <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground-muted">
          Returned from Stripe customer portal. Billing state will reflect the latest webhook sync.
        </p>
      ) : null}
      {checkoutSyncError ? (
        <p className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          Checkout sync warning: {checkoutSyncError}
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
                <span className="text-foreground-muted">Access source:</span> {accessSource}
              </p>
              <p>
                <span className="text-foreground-muted">Plan:</span>{" "}
                {context.ranch.subscriptionPlanKey ?? "Launch Plan"}
              </p>
              <p>
                <span className="text-foreground-muted">Stripe customer:</span>{" "}
                {context.ranch.stripeCustomerId ?? "Not created yet"}
              </p>
              <p>
                <span className="text-foreground-muted">Stripe subscription:</span>{" "}
                {context.ranch.stripeSubscriptionId ?? "Not active yet"}
              </p>
              <p>
                <span className="text-foreground-muted">Current period end:</span>{" "}
                {formatDate(context.ranch.subscriptionCurrentPeriodEnd, context.user.timeZone)}
              </p>
              <p>
                <span className="text-foreground-muted">Beta lifetime access:</span>{" "}
                {context.ranch.betaLifetimeAccess ? "Enabled" : "Not enabled"}
              </p>
              {trialEligible ? (
                <p>
                  <span className="text-foreground-muted">Trial offer:</span>{" "}
                  {trialConfig.trialDays}-day trial available for first checkout
                </p>
              ) : null}
            </div>
            {isOwner ? (
              <div className="space-y-3 pt-2">
                {hasStripeSubscriptionAccess ? (
                  <p className="text-sm text-foreground-muted">
                    Stripe subscription is already active. Use customer portal below to manage or
                    cancel.
                  </p>
                ) : (
                  <CheckoutForm
                    label={
                      trialEligible
                        ? `Start ${trialConfig.trialDays}-day trial in Stripe`
                        : "Start Stripe checkout"
                    }
                    pendingLabel={
                      trialEligible ? "Opening trial checkout..." : "Opening checkout..."
                    }
                  />
                )}
                {trialConfig.error ? (
                  <p className="text-sm text-warning">
                    Trial offer misconfigured: {trialConfig.error}
                  </p>
                ) : null}
                {hasStripeCustomer ? (
                  <div className="rounded-xl border bg-surface p-3">
                    <p className="text-sm font-semibold text-foreground">
                      Manage or cancel subscription
                    </p>
                    <p className="mt-1 text-sm text-foreground-muted">
                      Open Stripe Customer Portal to update payment method, view billing history,
                      or cancel membership.
                    </p>
                    <div className="pt-3">
                      <CustomerPortalForm />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-foreground-muted">
                    Customer portal becomes available after first Stripe checkout creates a customer
                    record.
                  </p>
                )}
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

      <Card>
        <CardContent className="space-y-3 py-6">
          <CardTitle>Timezone</CardTitle>
          <CardDescription>
            Set your timezone so payroll, time tracking, and dates render consistently for your account.
          </CardDescription>
          <TimeZoneForm currentTimeZone={context.user.timeZone} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 py-6">
          <CardTitle>Support Contact</CardTitle>
          <CardDescription>
            Direct contact for access or billing help while supporting client ranches.
          </CardDescription>
          <p className="text-sm">
            <span className="text-foreground-muted">Email:</span>{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="font-semibold text-accent hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>
          </p>
        </CardContent>
      </Card>

      {canSeeStatePreviews ? (
        <>
          <section className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardContent className="space-y-2 py-6">
                <CardTitle className="text-base">Access denied state</CardTitle>
                <CardDescription>
                  Preview the page shown when a user role lacks permission to open a route.
                </CardDescription>
                <Link
                  href="/app/access-denied"
                  className="text-sm font-semibold text-accent hover:underline"
                >
                  Open /app/access-denied
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-2 py-6">
                <CardTitle className="text-base">Billing required state</CardTitle>
                <CardDescription>
                  Preview the page shown when ranch billing access is inactive.
                </CardDescription>
                <Link
                  href="/app/billing-required"
                  className="text-sm font-semibold text-accent hover:underline"
                >
                  Open /app/billing-required
                </Link>
              </CardContent>
            </Card>
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
        </>
      ) : null}
    </div>
  );
}
