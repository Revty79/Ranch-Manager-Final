import { ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  trend?: string;
  className?: string;
}

export function StatCard({ label, value, trend, className }: StatCardProps) {
  return (
    <Card className={cn("border-accent-soft bg-surface", className)}>
      <CardContent className="space-y-2">
        <p className="text-xs uppercase tracking-[0.12em] text-foreground-muted">{label}</p>
        <p className="font-display text-3xl font-semibold text-foreground">{value}</p>
        {trend ? (
          <p className="inline-flex items-center gap-1 text-sm text-accent">
            <ArrowUpRight className="h-4 w-4" />
            {trend}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
