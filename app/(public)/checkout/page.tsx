import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/billing/checkout-form";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { getCurrentRanchContext, getCurrentUser } from "@/lib/auth/context";
import { hasBillingAccess } from "@/lib/billing/access";
import { isTrialEligible, resolveTrialConfig } from "@/lib/billing/trial";

export default async function CheckoutPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/signup");
  }

  const ranchContext = await getCurrentRanchContext();
  if (!ranchContext) {
    redirect("/onboarding");
  }

  if (ranchContext.membership.role !== "owner") {
    redirect("/app/settings");
  }

  if (hasBillingAccess(ranchContext.ranch)) {
    redirect("/app");
  }

  const trialConfig = resolveTrialConfig();
  const trialEligible =
    trialConfig.trialDays !== null && isTrialEligible(ranchContext.ranch);

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardContent className="space-y-4 py-8">
          <CardTitle className="text-2xl">Checkout</CardTitle>
          <CardDescription>
            {trialEligible
              ? `First checkout for this ranch includes a ${trialConfig.trialDays}-day trial in Stripe.`
              : "Billing uses a single Stripe subscription path for the bundled base ranch operations product."}
          </CardDescription>
          {trialConfig.error ? (
            <p className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
              Trial offer is misconfigured: {trialConfig.error}
            </p>
          ) : null}
          <CheckoutForm
            label={
              trialEligible
                ? `Start ${trialConfig.trialDays}-day trial in Stripe`
                : "Start Stripe checkout"
            }
            pendingLabel={trialEligible ? "Opening trial checkout..." : "Opening checkout..."}
          />
        </CardContent>
      </Card>
    </div>
  );
}
