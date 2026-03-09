import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: EmptyStateProps) {
  return (
    <Card className="border-dashed bg-surface">
      <CardContent className="flex flex-col items-start gap-3 py-10">
        {icon ? <div className="rounded-xl border bg-surface-strong p-2">{icon}</div> : null}
        <CardTitle>{title}</CardTitle>
        <CardDescription className="max-w-xl">{description}</CardDescription>
        {action ? <div className="pt-2">{action}</div> : null}
      </CardContent>
    </Card>
  );
}
