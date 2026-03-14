"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Input } from "@/components/ui/input";
import { animalSpeciesOptions } from "@/lib/herd/constants";
import {
  bulkMoveHeadcountFromUnitAction,
  type LandActionState,
} from "@/lib/land/actions";
import { formatLandUnitType, movementReasonOptions } from "@/lib/land/constants";
import type { LandUnitType } from "@/lib/db/schema";

const initialState: LandActionState = {};

interface SplitHerdMoveFormProps {
  fromLandUnitId: string;
  destinationUnits: Array<{ id: string; name: string; unitType: LandUnitType }>;
  animalClassOptions: string[];
}

export function SplitHerdMoveForm({
  fromLandUnitId,
  destinationUnits,
  animalClassOptions,
}: SplitHerdMoveFormProps) {
  const [state, formAction] = useActionState(
    bulkMoveHeadcountFromUnitAction,
    initialState,
  );

  if (!destinationUnits.length) {
    return (
      <p className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
        Add another active land unit before using split herd moves.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="fromLandUnitId" value={fromLandUnitId} />

      <FormFieldShell label="Destination unit">
        <select
          name="toLandUnitId"
          required
          defaultValue=""
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          <option value="" disabled>
            Select destination...
          </option>
          {destinationUnits.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name} ({formatLandUnitType(unit.unitType)})
            </option>
          ))}
        </select>
      </FormFieldShell>

      <div className="grid gap-3 md:grid-cols-2">
        <FormFieldShell label="Species">
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

        <FormFieldShell label="Headcount to move">
          <Input name="headCount" type="number" min={1} step={1} defaultValue={1} required />
        </FormFieldShell>
      </div>

      <FormFieldShell label="Class filter (optional)">
        <select
          name="animalClass"
          defaultValue=""
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          <option value="">All classes in selected species</option>
          {animalClassOptions.map((value) => (
            <option key={value} value={value}>
              {value}
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

      <FormFieldShell label="Notes (optional)">
        <Input
          name="notes"
          placeholder="Example: Move 20 cows to calving corral for this week."
        />
      </FormFieldShell>

      <p className="text-xs text-foreground-muted">
        Moves the selected headcount from this unit into the destination unit and preserves full movement history.
      </p>

      {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
      {state.success ? <p className="text-sm font-medium text-accent">{state.success}</p> : null}

      <SubmitButton
        label="Move split herd"
        pendingLabel="Moving split herd..."
        className="w-full md:w-fit"
      />
    </form>
  );
}
