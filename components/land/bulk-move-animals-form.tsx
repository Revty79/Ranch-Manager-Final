"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Input } from "@/components/ui/input";
import { animalSpeciesOptions } from "@/lib/herd/constants";
import {
  bulkAssignAnimalsToLandUnitAction,
  type LandActionState,
} from "@/lib/land/actions";
import { movementReasonOptions } from "@/lib/land/constants";

const initialState: LandActionState = {};

interface BulkMoveAnimalsFormProps {
  landUnitId: string;
}

export function BulkMoveAnimalsForm({ landUnitId }: BulkMoveAnimalsFormProps) {
  const [state, formAction] = useActionState(
    bulkAssignAnimalsToLandUnitAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="landUnitId" value={landUnitId} />

      <FormFieldShell label="Species to move">
        <select
          name="species"
          required
          defaultValue="cattle"
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          {animalSpeciesOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormFieldShell>

      <FormFieldShell label="Movement reason">
        <select
          name="movementReason"
          defaultValue="grazing_rotation"
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          {movementReasonOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormFieldShell>

      <FormFieldShell label="Movement notes (optional)">
        <Input
          name="notes"
          placeholder="Example: Move all cows for rotation cycle 3."
        />
      </FormFieldShell>

      <p className="text-xs text-foreground-muted">
        This moves all active, non-archived animals of the selected species into this unit.
      </p>

      {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
      {state.success ? <p className="text-sm font-medium text-accent">{state.success}</p> : null}

      <SubmitButton
        label="Move all selected species"
        pendingLabel="Moving animals..."
        className="w-full md:w-fit"
      />
    </form>
  );
}
