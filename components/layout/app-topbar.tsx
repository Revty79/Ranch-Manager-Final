import Link from "next/link";
import { logoutAction } from "@/lib/auth/actions";
import type { AppContext } from "@/lib/auth/context";
import { isPlatformAdminEmail } from "@/lib/auth/platform-admin";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AppTopbarProps {
  context: AppContext;
}

export function AppTopbar({ context }: AppTopbarProps) {
  const isPlatformAdmin = isPlatformAdminEmail(context.user.email);

  return (
    <header className="mb-6 flex flex-col gap-3 rounded-2xl border bg-surface-strong px-4 py-3 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.12em] text-foreground-muted">Operations</p>
        <p className="text-sm text-foreground">Plan, track, and pay with one workspace.</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="rounded-full border bg-surface px-3 py-1 text-xs font-semibold text-foreground-muted">
          {context.user.email}
        </span>
        <Link href="/app/settings" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
          Settings
        </Link>
        {isPlatformAdmin ? (
          <Link href="/admin" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
            Admin
          </Link>
        ) : null}
        <form action={logoutAction}>
          <button
            type="submit"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
