import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { getCurrentUser, getPostAuthRedirectPath } from "@/lib/auth/context";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect(await getPostAuthRedirectPath(user));
  }

  return (
    <Card className="w-full max-w-md">
      <CardContent className="space-y-5 py-8">
        <div>
          <CardTitle className="text-2xl">Log in</CardTitle>
          <CardDescription className="mt-2">
            Access your ranch workspace with your username and password.
          </CardDescription>
        </div>
        <LoginForm />
        <p className="text-sm text-foreground-muted">
          New here?{" "}
          <Link href="/signup" className="font-semibold text-accent">
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
