import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import {
  getCurrentRanchContext,
  getPostAuthRedirectPath,
  requireUser,
} from "@/lib/auth/context";

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.mustResetPassword) {
    redirect("/reset-password");
  }

  const ranchContext = await getCurrentRanchContext();

  if (ranchContext?.ranch.onboardingCompleted) {
    redirect(await getPostAuthRedirectPath(user));
  }

  return (
    <Card className="w-full max-w-xl">
      <CardContent className="space-y-5 py-8">
        <div>
          <CardTitle className="text-2xl">Create your ranch workspace</CardTitle>
          <CardDescription className="mt-2">
            One quick setup step with payroll defaults and optional starter recurring work
            templates. You will be assigned owner role for this ranch account.
          </CardDescription>
        </div>
        <OnboardingForm />
        <div className="rounded-xl border bg-surface p-3 text-sm text-foreground-muted">
          <p className="font-semibold text-foreground">After setup</p>
          <p>Invite your first manager/worker from Team, then open Work Orders and Payroll.</p>
        </div>
      </CardContent>
    </Card>
  );
}
