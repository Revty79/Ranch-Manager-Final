"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { reviewCompletedWorkOrderAction, type WorkOrderActionState } from "@/lib/work-orders/actions";
import type { WorkOrderCompletionReviewDetail } from "@/lib/work-orders/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const initialState: WorkOrderActionState = {};

function formatDateTime(value: Date | null, timeZone: string): string {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(value);
}

function formatReviewStatus(status: WorkOrderCompletionReviewDetail["status"]): string {
  if (status === "changes_requested") {
    return "Changes requested";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function CompletionReviewPanel({
  workOrderId,
  review,
  timeZone,
}: {
  workOrderId: string;
  review: WorkOrderCompletionReviewDetail;
  timeZone: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(reviewCompletedWorkOrderAction, initialState);

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [router, state.success]);

  return (
    <Card>
      <CardContent className="space-y-4 py-6">
        <div>
          <CardTitle className="text-base">Manager Completion Review</CardTitle>
          <CardDescription>
            {review.status === "pending"
              ? "A worker marked this task done. Review it before approving payout-triggered completion."
              : "Manager review history for this work order."}
          </CardDescription>
        </div>

        <div className="grid gap-3 rounded-xl border bg-surface p-4 text-sm md:grid-cols-2">
          <p>
            Requested by: {review.requestedByFullName ?? "Unknown member"}
          </p>
          <p>
            Requested at: {formatDateTime(review.requestedAt, timeZone)}
          </p>
          <p>
            Review status: {formatReviewStatus(review.status)}
          </p>
          <p>
            Reviewed by: {review.reviewedByFullName ?? "Not reviewed yet"}
          </p>
          <p className="md:col-span-2">
            Reviewed at: {formatDateTime(review.reviewedAt, timeZone)}
          </p>
        </div>

        {review.status === "pending" ? (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="workOrderId" value={workOrderId} />
            <div className="grid gap-2">
              <label className="flex items-start gap-2 rounded-xl border bg-surface px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  name="checklistCompletionVerified"
                  defaultChecked={review.checklistCompletionVerified}
                />
                <span>Work looks complete and matches the assignment.</span>
              </label>
              <label className="flex items-start gap-2 rounded-xl border bg-surface px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  name="checklistQualityVerified"
                  defaultChecked={review.checklistQualityVerified}
                />
                <span>Quality is acceptable for ranch standards.</span>
              </label>
              <label className="flex items-start gap-2 rounded-xl border bg-surface px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  name="checklistCleanupVerified"
                  defaultChecked={review.checklistCleanupVerified}
                />
                <span>Area, tools, and materials were cleaned up.</span>
              </label>
              <label className="flex items-start gap-2 rounded-xl border bg-surface px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  name="checklistFollowUpVerified"
                  defaultChecked={review.checklistFollowUpVerified}
                />
                <span>No immediate follow-up or rework is still needed.</span>
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">Manager notes</span>
              <Textarea
                name="managerNotes"
                defaultValue={review.managerNotes ?? ""}
                placeholder="Add notes if you are approving with context or sending the task back."
              />
              <span className="block text-xs text-foreground-muted">
                Notes are optional for approval and required if you send the task back.
              </span>
            </label>

            {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
            {state.success ? <p className="text-sm font-medium text-accent">{state.success}</p> : null}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" name="decision" value="approve">
                Approve work
              </Button>
              <Button type="submit" name="decision" value="send_back" variant="danger">
                Send back to crew
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="grid gap-2 rounded-xl border bg-surface p-4">
              <p>Work complete verified: {review.checklistCompletionVerified ? "Yes" : "No"}</p>
              <p>Quality verified: {review.checklistQualityVerified ? "Yes" : "No"}</p>
              <p>Cleanup verified: {review.checklistCleanupVerified ? "Yes" : "No"}</p>
              <p>Follow-up verified: {review.checklistFollowUpVerified ? "Yes" : "No"}</p>
            </div>
            <p className="rounded-xl border bg-surface px-3 py-2">
              Manager notes: {review.managerNotes?.trim() ? review.managerNotes : "None"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
