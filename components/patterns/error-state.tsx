import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";

interface ErrorStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  description = "Please retry in a moment. If this keeps happening, contact support.",
  actionLabel = "Retry",
  onAction,
}: ErrorStateProps) {
  return (
    <Card className="border-danger/40">
      <CardContent className="flex flex-col gap-3 py-8">
        <div className="flex items-center gap-2 text-danger">
          <TriangleAlert className="h-5 w-5" />
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
        <div>
          <Button variant="secondary" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
