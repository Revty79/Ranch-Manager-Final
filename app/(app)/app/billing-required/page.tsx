import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ShieldAlert, Wallet } from "lucide-react";
import { CheckoutForm } from "@/components/billing/checkout-form";
import { CouponCodeForm } from "@/components/billing/beta-code-form";
import { PageHeader } from "@/components/patterns/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { requireAppContext } from "@/lib/auth/context";
import { hasBillingAccess } from "@/lib/billing/access";
import { syncRanchFromCheckoutSession } from "@/lib/billing/stripe-sync";
import { isTrialEligible, resolveTrialConfig } from "@/lib/billing/trial";
import { cn } from "@/lib/utils";

const SUPPORT_EMAIL = "brannan.pearson.ranch@gmail.com";

export default async function AppBillingRequiredPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string; session_id?: string }>;
}) {
  const query = await searchParams;
  const billingQueryState = query.billing;
  const checkoutSessionId = query.session_id;
  let context = await requireAppContext();
  const isOwner = context.membership.role === "owner";
  let billingAccess = hasBillingAccess(context.ranch);
  let checkoutSyncError: string | null = null;

  if (
    isOwner &&
    !billingAccess &&
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
      billingAccess = hasBillingAccess(context.ranch);
    }
  }

  const trialConfig = resolveTrialConfig();
  const trialEligible =
    trialConfig.trialDays !== null && isTrialEligible(context.ranch);

  if (billingAccess) {
    redirect("/app");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Activation"
        title="Activate ranch access"
        description="This ranch is currently blocked from bundled base product routes. Complete activation below to unlock `/app`."
      />

      {billingQueryState === "trial_started" ? (
        <p className="rounded-xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-accent">
          Trial checkout completed. Subscription access is syncing now.
        </p>
      ) : null}
      {billingQueryState === "success" ? (
        <p className="rounded-xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-accent">
          Checkout completed. Subscription access is syncing now.
        </p>
      ) : null}
      {billingQueryState === "cancel" ? (
        <p className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          Checkout was canceled. You can retry activation when ready.
        </p>
      ) : null}
      {checkoutSyncError ? (
        <p className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          Checkout sync warning: {checkoutSyncError}
        </p>
      ) : null}

      <Card className="border-warning/50">
        <CardContent className="space-y-3 py-6">
          <div className="flex items-center gap-2 text-warning">
            <Wallet className="h-5 w-5" />
            <CardTitle className="text-base">Billing access is required</CardTitle>
          </div>
          <CardDescription>
            Ranch Manager requires an active subscription or approved beta lifetime access for
            bundled base production routes, including herd and land management.
          </CardDescription>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p>
              <span className="text-foreground-muted">Current status:</span>{" "}
              <Badge variant="warning">{context.ranch.subscriptionStatus}</Badge>
            </p>
            <p>
              <span className="text-foreground-muted">Beta lifetime access:</span>{" "}
              {context.ranch.betaLifetimeAccess ? "Enabled" : "Not enabled"}
            </p>
          </div>
          {trialEligible ? (
            <p className="text-sm text-foreground-muted">
              Trial offer available: this ranch can start a {trialConfig.trialDays}-day Stripe
              trial before first billing.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {trialConfig.error && isOwner ? (
        <p className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          Trial offer is misconfigured: {trialConfig.error}
        </p>
      ) : null}

      {isOwner ? (
        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardContent className="space-y-4 py-6">
              <div className="space-y-1">
                <CardTitle>
                  {trialEligible ? "1) Start trial checkout" : "1) Start subscription"}
                </CardTitle>
                <CardDescription>
                  {trialEligible
                    ? `Launch Stripe checkout with a ${trialConfig.trialDays}-day trial for this ranch.`
                    : "Launch Stripe checkout for this ranch owner account and activate paid access."}
                </CardDescription>
              </div>
              <CheckoutForm
                returnPath="/app/billing-required"
                label={
                  trialEligible
                    ? `Start ${trialConfig.trialDays}-day trial in Stripe`
                    : "Start Stripe checkout"
                }
                pendingLabel={
                  trialEligible ? "Opening trial checkout..." : "Opening checkout..."
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 py-6">
              <div className="space-y-1">
                <CardTitle>2) Redeem access code</CardTitle>
                <CardDescription>
                  If you were issued a lifetime beta code, apply it here for internal access.
                </CardDescription>
              </div>
              <CouponCodeForm />
            </CardContent>
          </Card>
        </section>
      ) : (
        <Card>
          <CardContent className="space-y-3 py-6">
            <div className="flex items-center gap-2 text-warning">
              <ShieldAlert className="h-5 w-5" />
              <CardTitle className="text-base">Owner action required</CardTitle>
            </div>
            <CardDescription>
              Billing controls are owner-only. Contact your ranch owner to activate access, then
              reload this page.
            </CardDescription>
            <p className="text-sm text-foreground-muted">
              Your current role: <span className="font-semibold">{context.membership.role}</span>
            </p>
            <Link
              href="/app/settings"
              className={cn(buttonVariants({ variant: "secondary" }), "w-fit")}
            >
              Open settings
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-3 py-6">
          <div className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-5 w-5" />
            <CardTitle className="text-base">Need activation help?</CardTitle>
          </div>
          <CardDescription>
            If checkout fails or your code is not being accepted, contact support for manual
            review.
          </CardDescription>
          <p className="text-sm">
            <span className="text-foreground-muted">Support:</span>{" "}
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
