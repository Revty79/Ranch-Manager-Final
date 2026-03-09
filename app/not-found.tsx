import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
        404
      </p>
      <h1 className="font-display text-3xl font-semibold">Page not found</h1>
      <p className="text-foreground-muted">
        The page you requested is not available in this ranch workspace.
      </p>
      <Link href="/" className={cn(buttonVariants())}>
        Back to home
      </Link>
    </div>
  );
}
