"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Input } from "@/components/ui/input";
import { assignAnimalToLandUnitAction, type LandActionState } from "@/lib/land/actions";
import { movementReasonOptions } from "@/lib/land/constants";
import type { LandMovementAnimalOption } from "@/lib/land/queries";

const initialState: LandActionState = {};

interface MoveAnimalFormProps {
  landUnitId: string;
  animalOptions: LandMovementAnimalOption[];
}

export function MoveAnimalForm({ landUnitId, animalOptions }: MoveAnimalFormProps) {
  const [state, formAction] = useActionState(assignAnimalToLandUnitAction, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="landUnitId" value={landUnitId} />

      <FormFieldShell label="Animal">
        <select
          name="animalId"
          required
          defaultValue=""
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          <option value="" disabled>
            Select animal...
          </option>
          {animalOptions.map((option) => (
            <option key={option.animalId} value={option.animalId}>
              {option.label}
            </option>
          ))}
        </select>
      </FormFieldShell>

      <FormFieldShell label="Movement reason">
        <select
          name="movementReason"
          defaultValue="other"
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
        <Input name="notes" placeholder="Why this move is happening right now." />
      </FormFieldShell>

      {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
      {state.success ? <p className="text-sm font-medium text-accent">{state.success}</p> : null}
      <SubmitButton label="Move animal" pendingLabel="Recording move..." className="w-full md:w-fit" />
    </form>
  );
}
