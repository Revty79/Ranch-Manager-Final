import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { getPostAuthRedirectPath, requireUser } from "@/lib/auth/context";

export default async function ResetPasswordPage() {
  const user = await requireUser();
  if (!user.mustResetPassword) {
    redirect(await getPostAuthRedirectPath(user));
  }

  return (
    <Card className="w-full max-w-md">
      <CardContent className="space-y-5 py-8">
        <div>
          <CardTitle className="text-2xl">Set your new password</CardTitle>
          <CardDescription className="mt-2">
            Your temporary password has expired for app access. Choose a new password to continue.
          </CardDescription>
        </div>
        <ResetPasswordForm />
      </CardContent>
    </Card>
  );
}
