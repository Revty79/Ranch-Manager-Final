import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/billing/checkout-form";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { getCurrentRanchContext, getCurrentUser } from "@/lib/auth/context";
import { hasBillingAccess } from "@/lib/billing/access";

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

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardContent className="space-y-4 py-8">
          <CardTitle className="text-2xl">Checkout</CardTitle>
          <CardDescription>
            Launch billing is a single Stripe subscription path for full product access.
          </CardDescription>
          <CheckoutForm />
        </CardContent>
      </Card>
    </div>
  );
}
