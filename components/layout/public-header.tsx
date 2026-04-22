import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { publicNav } from "@/lib/site-config";
import { cn } from "@/lib/utils";

export function PublicHeader() {
  const desktopCta = "Start account";
  const mobileCta = "Start";

  return (
    <header className="sticky top-0 z-40 border-b bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="font-display text-lg font-semibold tracking-tight">
          Ranch Manager
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {publicNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-foreground-muted transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/demo"
            className={cn(buttonVariants({ size: "sm", variant: "secondary" }))}
          >
            View demo
          </Link>
          <Link
            href="/signup"
            className={cn(buttonVariants({ size: "sm" }), "text-white")}
            style={{ color: "#fff" }}
          >
            {desktopCta}
          </Link>
        </nav>
        <Link
          href="/signup"
          className={cn(buttonVariants({ size: "sm" }), "text-white md:hidden")}
          style={{ color: "#fff" }}
        >
          {mobileCta}
        </Link>
      </div>
    </header>
  );
}
