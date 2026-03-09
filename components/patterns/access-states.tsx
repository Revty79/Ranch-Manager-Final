import Link from "next/link";
import { Lock, ShieldAlert, Wallet } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StateShellProps {
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}

function StateShell({ title, description, actionLabel, actionHref }: StateShellProps) {
  return (
    <Card className="max-w-2xl">
      <CardContent className="space-y-4 py-10">
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription className="text-base">{description}</CardDescription>
        <Link href={actionHref} className={cn(buttonVariants())}>
          {actionLabel}
        </Link>
      </CardContent>
    </Card>
  );
}

export function AccessDeniedShell() {
  return (
    <div className="space-y-4">
      <ShieldAlert className="h-6 w-6 text-warning" />
      <StateShell
        title="Access denied"
        description="Your role does not currently include this area. Reach out to your ranch owner for access updates."
        actionLabel="Back to dashboard"
        actionHref="/app"
      />
    </div>
  );
}

export function BillingRequiredShell() {
  return (
    <div className="space-y-4">
      <Wallet className="h-6 w-6 text-warning" />
      <StateShell
        title="Billing required"
        description="Your ranch needs an active subscription to continue using Ranch Manager Final."
        actionLabel="Open settings"
        actionHref="/app/settings"
      />
    </div>
  );
}

export function NoRanchAccessShell() {
  return (
    <div className="space-y-4">
      <Lock className="h-6 w-6 text-warning" />
      <StateShell
        title="No ranch access"
        description="Your account is active, but it is not currently linked to a ranch workspace."
        actionLabel="Start onboarding"
        actionHref="/onboarding"
      />
    </div>
  );
}

export function OnboardingIncompleteShell() {
  return (
    <div className="space-y-4">
      <Lock className="h-6 w-6 text-warning" />
      <StateShell
        title="Onboarding incomplete"
        description="Finish ranch setup to unlock the operational workspace."
        actionLabel="Start onboarding"
        actionHref="/onboarding"
      />
    </div>
  );
}
