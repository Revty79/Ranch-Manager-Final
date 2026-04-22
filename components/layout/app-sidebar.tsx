import Link from "next/link";
import { appNav } from "@/lib/site-config";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AppContext } from "@/lib/auth/context";

interface AppSidebarProps {
  context: AppContext;
}

export function AppSidebar({ context }: AppSidebarProps) {
  const navItems = appNav.filter((item) => {
    if (item.href === "/app/needs-attention") {
      return context.membership.role === "owner" || context.membership.role === "manager";
    }

    return true;
  });

  return (
    <aside className="space-y-4">
      <Card>
        <CardContent className="space-y-3 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-foreground-muted">Ranch</p>
            <p className="font-display text-lg font-semibold">{context.ranch.name}</p>
          </div>
          <Badge variant="success">{context.membership.role} access</Badge>
        </CardContent>
      </Card>
      <nav className="rounded-2xl border bg-surface-strong p-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex rounded-xl px-3 py-2 text-sm font-medium text-foreground-muted transition-colors hover:bg-accent-soft hover:text-foreground"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
