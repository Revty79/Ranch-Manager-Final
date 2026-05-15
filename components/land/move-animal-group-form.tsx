"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Input } from "@/components/ui/input";
import { movementReasonOptions } from "@/lib/land/constants";
import {
  moveAnimalGroupToLandUnitAction,
  type LandActionState,
} from "@/lib/land/actions";
import type { LandMovementGroupOption } from "@/lib/land/queries";

const initialState: LandActionState = {};

interface MoveAnimalGroupFormProps {
  landUnitId: string;
  groupOptions: LandMovementGroupOption[];
}

export function MoveAnimalGroupForm({
  landUnitId,
  groupOptions,
}: MoveAnimalGroupFormProps) {
  const [state, formAction] = useActionState(
    moveAnimalGroupToLandUnitAction,
    initialState,
  );

  if (!groupOptions.length) {
    return (
      <p className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
        No active herd/groups are available in this ranch yet.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="landUnitId" value={landUnitId} />

      <FormFieldShell
        label="Saved herd/group"
        hint="Move all active animals in a saved herd/group into this land unit. This updates current occupancy and preserves movement history."
      >
        <select
          name="animalGroupId"
          required
          defaultValue=""
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          <option value="" disabled>
            Select herd/group...
          </option>
          {groupOptions.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name} ({group.memberCount} active)
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
          placeholder="Example: Move spring cow-calf herd to fresh rotation."
        />
      </FormFieldShell>

      {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
      {state.success ? <p className="text-sm font-medium text-accent">{state.success}</p> : null}
      <SubmitButton
        label="Move herd/group into unit"
        pendingLabel="Moving herd/group..."
        className="w-full md:w-fit"
      />
    </form>
  );
}
