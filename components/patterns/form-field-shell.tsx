import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FormFieldShellProps {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}

export function FormFieldShell({
  label,
  hint,
  error,
  children,
  className,
}: FormFieldShellProps) {
  return (
    <label className={cn("block space-y-2", className)}>
      <span className="text-sm font-semibold text-foreground">{label}</span>
      {children}
      {error ? (
        <span className="block text-xs font-medium text-danger">{error}</span>
      ) : hint ? (
        <span className="block text-xs text-foreground-muted">{hint}</span>
      ) : null}
    </label>
  );
}
