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

function formatBoolean(value: boolean): string {
  return value ? "Yes" : "No";
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

        <div className="space-y-3 rounded-xl border bg-surface p-4">
          <p className="text-sm font-semibold">Worker Proof Of Completion</p>
          {review.workerSubmission ? (
            <>
              <div className="grid gap-2 text-sm md:grid-cols-2">
                <p>
                  Submitted by: {review.workerSubmission.submittedByFullName ?? "Unknown member"}
                </p>
                <p>
                  Submitted at: {formatDateTime(review.workerSubmission.submittedAt, timeZone)}
                </p>
              </div>
              <p className="rounded-xl border bg-surface-strong px-3 py-2 text-sm">
                Worker note:{" "}
                {review.workerSubmission.completionNote?.trim()
                  ? review.workerSubmission.completionNote
                  : "None provided"}
              </p>
              <div className="grid gap-2 rounded-xl border bg-surface-strong p-3 text-sm md:grid-cols-2">
                <p>
                  Scope completed:{" "}
                  {formatBoolean(review.workerSubmission.checklistScopeCompleted)}
                </p>
                <p>
                  Quality checked:{" "}
                  {formatBoolean(review.workerSubmission.checklistQualityChecked)}
                </p>
                <p>
                  Cleanup completed:{" "}
                  {formatBoolean(review.workerSubmission.checklistCleanupCompleted)}
                </p>
                <p>
                  Follow-up noted:{" "}
                  {formatBoolean(review.workerSubmission.checklistFollowUpNoted)}
                </p>
              </div>
              {review.workerSubmission.evidence.length ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground-muted">
                    Worker evidence
                  </p>
                  <ul className="space-y-2">
                    {review.workerSubmission.evidence.map((evidence) => (
                      <li
                        key={evidence.id}
                        className="rounded-xl border bg-surface-strong px-3 py-2 text-sm"
                      >
                        <p className="font-medium">
                          {evidence.label?.trim() ? evidence.label : "Evidence item"}
                        </p>
                        <p className="text-xs text-foreground-muted">
                          Type: {evidence.evidenceType}
                        </p>
                        {evidence.url ? (
                          <a
                            href={evidence.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-accent hover:underline"
                          >
                            Open link
                          </a>
                        ) : null}
                        {evidence.notes?.trim() ? (
                          <p className="mt-1 text-xs text-foreground-muted">{evidence.notes}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-foreground-muted">
                  No supporting evidence links were attached.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-foreground-muted">
              No worker submission details were attached to this completion.
            </p>
          )}
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
