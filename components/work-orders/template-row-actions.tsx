"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import {
  createWorkOrderFromTemplateAction,
  type WorkOrderActionState,
  updateWorkOrderTemplateRecurrenceAction,
} from "@/lib/work-orders/actions";
import type { WorkOrderTemplateListItem } from "@/lib/work-orders/queries";

const initialState: WorkOrderActionState = {};

export function TemplateRowActions({
  template,
}: {
  template: WorkOrderTemplateListItem;
}) {
  const [createState, createAction] = useActionState(
    createWorkOrderFromTemplateAction,
    initialState,
  );
  const [recurrenceState, recurrenceAction] = useActionState(
    updateWorkOrderTemplateRecurrenceAction,
    initialState,
  );

  return (
    <div className="mt-3 grid gap-3 lg:grid-cols-[auto_1fr]">
      <form action={createAction} className="space-y-2">
        <input type="hidden" name="templateId" value={template.id} />
        <SubmitButton
          label="Create now"
          pendingLabel="Creating..."
          className="h-9 rounded-xl border bg-surface-strong px-3 text-xs font-semibold hover:bg-accent-soft"
        />
        {createState.error ? (
          <p className="max-w-[14rem] text-xs font-medium text-danger">{createState.error}</p>
        ) : null}
        {createState.success ? (
          <p className="max-w-[14rem] text-xs font-medium text-accent">{createState.success}</p>
        ) : null}
      </form>

      <form action={recurrenceAction} className="space-y-2">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <input type="hidden" name="templateId" value={template.id} />
          <label className="flex items-center gap-2 rounded-xl border bg-surface-strong px-3 py-2 text-xs">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={template.isActive}
            />
            Active
          </label>
          <label className="flex items-center gap-2 rounded-xl border bg-surface-strong px-3 py-2 text-xs">
            <input
              type="checkbox"
              name="recurringEnabled"
              defaultChecked={template.recurringEnabled}
            />
            Recurring
          </label>
          <select
            name="recurrenceCadence"
            defaultValue={template.recurrenceCadence ?? ""}
            className="h-9 rounded-xl border bg-surface-strong px-3 text-xs"
          >
            <option value="">Cadence</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="custom">Custom</option>
          </select>
          <input
            name="recurrenceIntervalDays"
            type="number"
            min="1"
            defaultValue={template.recurrenceIntervalDays ?? ""}
            placeholder="Custom days"
            className="h-9 rounded-xl border bg-surface-strong px-3 text-xs"
          />
          <div className="flex gap-2">
            <input
              name="nextGenerationOn"
              type="date"
              defaultValue={template.nextGenerationOn ?? ""}
              className="h-9 w-full rounded-xl border bg-surface-strong px-3 text-xs"
            />
            <SubmitButton
              label="Save"
              pendingLabel="Saving..."
              className="h-9 rounded-xl border bg-surface-strong px-3 text-xs font-semibold hover:bg-accent-soft"
            />
          </div>
        </div>
        {recurrenceState.error ? (
          <p className="text-xs font-medium text-danger">{recurrenceState.error}</p>
        ) : null}
        {recurrenceState.success ? (
          <p className="text-xs font-medium text-accent">{recurrenceState.success}</p>
        ) : null}
      </form>
    </div>
  );
}
