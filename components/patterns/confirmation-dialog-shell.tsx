import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";

interface ConfirmationDialogShellProps {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function ConfirmationDialogShell({
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
}: ConfirmationDialogShellProps) {
  return (
    <Card className="max-w-lg">
      <CardContent className="space-y-4 py-6">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <div className="flex items-center gap-2">
          <Button variant="secondary">{cancelLabel}</Button>
          <Button>{confirmLabel}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
