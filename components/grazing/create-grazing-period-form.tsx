"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createGrazingPeriodAction,
  type GrazingActionState,
} from "@/lib/grazing/actions";

const initialState: GrazingActionState = {};

interface CreateGrazingPeriodFormProps {
  options: {
    landUnits: Array<{ id: string; name: string; unitType: string }>;
    animalGroups: Array<{ id: string; name: string }>;
    animals: Array<{ id: string; label: string }>;
  };
}

export function CreateGrazingPeriodForm({ options }: CreateGrazingPeriodFormProps) {
  const [state, formAction] = useActionState(createGrazingPeriodAction, initialState);

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2">
      <FormFieldShell label="Land unit">
        <select
          name="landUnitId"
          required
          defaultValue=""
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          <option value="" disabled>
            Select unit...
          </option>
          {options.landUnits.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name} ({unit.unitType.replace("_", " ")})
            </option>
          ))}
        </select>
      </FormFieldShell>
      <FormFieldShell label="Status">
        <select
          name="status"
          defaultValue="active"
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          <option value="planned">Planned</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </FormFieldShell>

      <FormFieldShell label="Start date">
        <Input name="startedOn" type="date" required />
      </FormFieldShell>
      <FormFieldShell label="End date (optional)">
        <Input name="endedOn" type="date" />
      </FormFieldShell>

      <FormFieldShell label="Planned move date (optional)">
        <Input name="plannedMoveOn" type="date" />
      </FormFieldShell>
      <FormFieldShell label="Animal group (optional)">
        <select
          name="animalGroupId"
          defaultValue=""
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          <option value="">No group linkage</option>
          {options.animalGroups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </FormFieldShell>

      <div className="md:col-span-2">
        <FormFieldShell
          label="Linked animals (optional)"
          hint="Hold Ctrl/Cmd to select multiple. If none selected, planning can still proceed."
        >
          <select
            name="animalIds"
            multiple
            size={6}
            className="w-full rounded-xl border bg-surface px-3 py-2 text-sm"
          >
            {options.animals.map((animal) => (
              <option key={animal.id} value={animal.id}>
                {animal.label}
              </option>
            ))}
          </select>
        </FormFieldShell>
      </div>

      <div className="md:col-span-2">
        <FormFieldShell label="Notes">
          <Textarea
            name="notes"
            placeholder="Season conditions, forage assumptions, planned checks."
            className="min-h-20"
          />
        </FormFieldShell>
      </div>

      <div className="md:col-span-2 flex flex-col gap-2">
        {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
        {state.success ? <p className="text-sm font-medium text-accent">{state.success}</p> : null}
        <SubmitButton
          label="Record grazing period"
          pendingLabel="Saving grazing period..."
          className="w-full md:w-fit"
        />
      </div>
    </form>
  );
}
