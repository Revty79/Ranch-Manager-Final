import type { ReactNode } from "react";
import { PublicHeader } from "@/components/layout/public-header";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <div className="flex items-start justify-center lg:justify-start">{children}</div>
          <Card className="hidden lg:block">
            <CardContent className="space-y-4 py-8">
              <CardTitle className="text-2xl">Operations-first from sign-in to daily use</CardTitle>
              <CardDescription className="text-sm">
                The same visual language you see on public pages carries directly into the
                app workspace so onboarding feels consistent and trustworthy.
              </CardDescription>
              <ul className="space-y-2 text-sm text-foreground-muted">
                <li>- Team setup with role-aware controls</li>
                <li>- Work-order assignment and status visibility</li>
                <li>- Shift and task time tracking readiness</li>
                <li>- Payroll summary and billing access foundations</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
