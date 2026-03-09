"use client";

import { ErrorState } from "@/components/patterns/error-state";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="Unable to load this app section"
      description="Please try again. If the issue continues, check server logs and ranch access state."
      actionLabel="Try again"
      onAction={reset}
    />
  );
}
