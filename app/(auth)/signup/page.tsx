import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/signup-form";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { getCurrentUser, getPostAuthRedirectPath } from "@/lib/auth/context";

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect(await getPostAuthRedirectPath(user));
  }

  return (
    <Card className="w-full max-w-md">
      <CardContent className="space-y-5 py-8">
        <div>
          <CardTitle className="text-2xl">Create your account</CardTitle>
          <CardDescription className="mt-2">
            Set up your owner account, choose a username, and start your ranch workspace.
          </CardDescription>
        </div>
        <SignupForm />
        <p className="text-sm text-foreground-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-accent">
            Log in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
