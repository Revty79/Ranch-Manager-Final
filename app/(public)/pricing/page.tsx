import Link from "next/link";
import { Check } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { resolveTrialConfig } from "@/lib/billing/trial";
import { marketingContent } from "@/lib/marketing-content";
import { cn } from "@/lib/utils";

export default function PricingPage() {
  const pricing = marketingContent.pricing;
  const trialConfig = resolveTrialConfig();
  const hasLaunchTrial = trialConfig.trialDays !== null && !trialConfig.error;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="space-y-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
          Launch Pricing
        </p>
        <h1 className="font-display text-4xl font-semibold">One plan. One operating system.</h1>
        <p className="mx-auto max-w-2xl text-foreground-muted">
          Ranch Manager uses one bundled base subscription covering crew, work, time,
          payroll, herd, and land operations.
        </p>
      </header>

      <Card className="border-accent/35">
        <CardContent className="grid gap-6 py-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-3">
            <CardTitle className="text-2xl">{pricing.planName}</CardTitle>
            <p className="font-display text-4xl font-semibold">{pricing.amount}</p>
            <p className="text-sm text-foreground-muted">{pricing.cadence}</p>
            <CardDescription>{pricing.description}</CardDescription>
            <Link
              href="/checkout"
              className={cn(buttonVariants({ size: "lg" }), "mt-2 text-white")}
              style={{ color: "#fff" }}
            >
              Go to checkout
            </Link>
            <p className="text-xs text-foreground-muted">
              {hasLaunchTrial
                ? `Checkout is presented after account creation. Eligible ranches start with a ${trialConfig.trialDays}-day Stripe trial.`
                : "Checkout step is presented after account creation."}
            </p>
          </div>
          <div className="space-y-6">
            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">Included at launch</p>
              <ul className="space-y-2 text-sm text-foreground-muted">
                {pricing.included.map((item) => (
                  <li key={item} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">Not included yet</p>
              <ul className="space-y-2 text-sm text-foreground-muted">
                {pricing.notIncludedYet.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-border" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
