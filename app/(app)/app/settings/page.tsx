import { PageHeader } from "@/components/patterns/page-header";
import { CouponCodeForm } from "@/components/billing/beta-code-form";
import { CheckoutForm } from "@/components/billing/checkout-form";
import { CustomerPortalForm } from "@/components/billing/customer-portal-form";
import { TimeZoneForm } from "@/components/settings/timezone-form";
import { requireSectionAccess } from "@/lib/auth/context";
import { hasBillingAccess } from "@/lib/billing/access";
import { syncRanchFromCheckoutSession } from "@/lib/billing/stripe-sync";
import { isTrialEligible, resolveTrialConfig } from "@/lib/billing/trial";
import { setRanchAdminAccessAction } from "@/lib/settings/actions";
import { getSupportedTimeZones } from "@/lib/timezone";
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
  let context = await requireSectionAccess("settings", "view", { requirePaid: false });
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
      context = await requireSectionAccess("settings", "view", { requirePaid: false });
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
  const supportedTimeZones = getSupportedTimeZones();
  const accessSource = context.ranch.betaLifetimeAccess
    ? "Beta lifetime code"
    : context.ranch.subscriptionStatus === "active" ||
        context.ranch.subscriptionStatus === "trialing"
      ? "Stripe subscription"
      : "No active access source";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Account & Billing"
        description="Ranch identity, role context, and bundled base subscription access state."
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
              <p>
                <span className="text-foreground-muted">Platform admin access:</span>{" "}
                <Badge
                  variant={context.ranch.allowPlatformAdminAccess ? "success" : "warning"}
                >
                  {context.ranch.allowPlatformAdminAccess ? "Allowed" : "Blocked"}
                </Badge>
              </p>
            </div>
            <div className="rounded-xl border bg-surface p-3 text-sm">
              <p className="font-semibold text-foreground">Admin Access Failsafe</p>
              <p className="mt-1 text-foreground-muted">
                This switch controls whether platform admins can enter this ranch workspace from
                the admin control center. Default is blocked.
              </p>
              {isOwner ? (
                <form action={setRanchAdminAccessAction} className="mt-3">
                  <input
                    type="hidden"
                    name="enabled"
                    value={context.ranch.allowPlatformAdminAccess ? "false" : "true"}
                  />
                  <button
                    type="submit"
                    className="rounded-xl border bg-surface-strong px-3 py-2 text-xs font-semibold hover:bg-accent-soft"
                  >
                    {context.ranch.allowPlatformAdminAccess
                      ? "Block admin access"
                      : "Allow admin access"}
                  </button>
                </form>
              ) : (
                <p className="mt-3 text-foreground-muted">Only ranch owners can change this setting.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 py-6">
            <CardTitle>Subscription Access</CardTitle>
            <CardDescription>
              Paid access unlocks the bundled base app (crew, work, time, payroll, herd, and land)
              unless beta lifetime access is enabled.
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
                {context.ranch.subscriptionPlanKey ?? "Bundled Base Plan"}
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
          <CardTitle>Ranch Timezone</CardTitle>
          <CardDescription>
            Owners set one timezone for this ranch. All members in this ranch use it for payroll,
            scheduling, and timestamp rendering.
          </CardDescription>
          {isOwner ? (
            <TimeZoneForm
              currentTimeZone={context.ranch.timeZone}
              timeZoneOptions={supportedTimeZones}
            />
          ) : (
            <p className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
              Current ranch timezone:{" "}
              <span className="font-semibold text-foreground">{context.ranch.timeZone}</span>. Only
              ranch owners can change this setting.
            </p>
          )}
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

    </div>
  );
}
