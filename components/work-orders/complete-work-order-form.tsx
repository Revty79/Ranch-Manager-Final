"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { completeWorkOrderAction, type TimeActionState } from "@/lib/time/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface CompletionWorkOrderOption {
  id: string;
  title: string;
}

interface CompleteWorkOrderFormProps {
  workOrderId?: string;
  workOrderOptions?: CompletionWorkOrderOption[];
  submitLabel?: string;
  buttonVariant?: "primary" | "secondary";
}

const initialState: TimeActionState = {};

function hasSelectableOptions(
  workOrderId: string | undefined,
  workOrderOptions: CompletionWorkOrderOption[] | undefined,
): boolean {
  if (workOrderId) {
    return true;
  }

  return Boolean(workOrderOptions && workOrderOptions.length > 0);
}

export function CompleteWorkOrderForm({
  workOrderId,
  workOrderOptions,
  submitLabel = "Complete work order",
  buttonVariant = "primary",
}: CompleteWorkOrderFormProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(completeWorkOrderAction, initialState);

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [router, state.success]);

  if (!hasSelectableOptions(workOrderId, workOrderOptions)) {
    return null;
  }

  return (
    <form action={formAction} className="space-y-3 rounded-xl border bg-surface p-3">
      {workOrderId ? <input type="hidden" name="workOrderId" value={workOrderId} /> : null}

      {!workOrderId ? (
        <select
          name="workOrderId"
          className="h-10 w-full rounded-xl border bg-surface-strong px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          defaultValue=""
          required
        >
          <option value="" disabled>
            Select work order to complete
          </option>
          {(workOrderOptions ?? []).map((option) => (
            <option key={option.id} value={option.id}>
              {option.title}
            </option>
          ))}
        </select>
      ) : null}

      <details className="rounded-xl border bg-surface-strong">
        <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-foreground-muted">
          Add completion proof (recommended)
        </summary>
        <div className="space-y-3 border-t px-3 py-3">
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground-muted">
              Completion note
            </span>
            <Textarea
              name="completionNote"
              placeholder="What was done, what materials were used, and any issues to note."
            />
          </label>

          <div className="grid gap-2">
            <label className="flex items-start gap-2 rounded-xl border bg-surface px-3 py-2 text-sm">
              <input type="checkbox" name="checklistScopeCompleted" defaultChecked />
              <span>I completed the assigned scope.</span>
            </label>
            <label className="flex items-start gap-2 rounded-xl border bg-surface px-3 py-2 text-sm">
              <input type="checkbox" name="checklistQualityChecked" defaultChecked />
              <span>I checked work quality before submitting.</span>
            </label>
            <label className="flex items-start gap-2 rounded-xl border bg-surface px-3 py-2 text-sm">
              <input type="checkbox" name="checklistCleanupCompleted" defaultChecked />
              <span>I cleaned the area, tools, and materials.</span>
            </label>
            <label className="flex items-start gap-2 rounded-xl border bg-surface px-3 py-2 text-sm">
              <input type="checkbox" name="checklistFollowUpNoted" />
              <span>I documented any follow-up that is still needed.</span>
            </label>
          </div>

          {[1, 2, 3].map((slot) => (
            <div key={slot} className="grid gap-2 rounded-xl border bg-surface p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground-muted">
                Evidence {slot}
              </p>
              <input
                name={`evidenceLabel${slot}`}
                placeholder="Label (example: South gate latch repaired)"
                className="h-10 rounded-xl border bg-surface-strong px-3 text-sm"
              />
              <input
                name={`evidenceUrl${slot}`}
                placeholder="https:// link to photo, file, or note reference"
                className="h-10 rounded-xl border bg-surface-strong px-3 text-sm"
              />
              <input
                name={`evidenceNotes${slot}`}
                placeholder="Optional context for this evidence"
                className="h-10 rounded-xl border bg-surface-strong px-3 text-sm"
              />
            </div>
          ))}

          <p className="text-xs text-foreground-muted">
            Evidence links are optional. Photo/file uploads can be added cleanly in a future step
            using the same evidence model.
          </p>
        </div>
      </details>

      {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
      {state.success ? <p className="text-sm font-medium text-accent">{state.success}</p> : null}

      <Button variant={buttonVariant} type="submit">
        {submitLabel}
      </Button>
    </form>
  );
}

