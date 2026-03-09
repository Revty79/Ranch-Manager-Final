import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "mb-6 flex flex-col gap-4 rounded-2xl border bg-surface-strong p-5 lg:flex-row lg:items-center lg:justify-between",
        className,
      )}
    >
      <div>
        {eyebrow ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-foreground-muted">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-2xl font-semibold leading-tight">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm text-foreground-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
