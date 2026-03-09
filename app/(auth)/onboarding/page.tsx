import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { getCurrentRanchContext, requireUser } from "@/lib/auth/context";

export default async function OnboardingPage() {
  await requireUser();
  const ranchContext = await getCurrentRanchContext();

  if (ranchContext?.ranch.onboardingCompleted) {
    redirect("/app");
  }

  return (
    <Card className="w-full max-w-xl">
      <CardContent className="space-y-5 py-8">
        <div>
          <CardTitle className="text-2xl">Create your ranch workspace</CardTitle>
          <CardDescription className="mt-2">
            One quick setup step. You will be assigned owner role for this ranch account.
          </CardDescription>
        </div>
        <OnboardingForm />
      </CardContent>
    </Card>
  );
}
