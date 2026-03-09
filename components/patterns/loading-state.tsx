import { LoaderCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";

interface LoadingStateProps {
  title?: string;
  description?: string;
}

export function LoadingState({
  title = "Loading",
  description = "We are preparing your ranch data.",
}: LoadingStateProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-10">
        <LoaderCircle className="h-5 w-5 animate-spin text-accent" />
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardContent>
    </Card>
  );
}
