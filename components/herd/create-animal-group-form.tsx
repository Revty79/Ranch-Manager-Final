"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createAnimalGroupAction,
  type HerdGroupActionState,
} from "@/lib/herd/group-actions";
import { animalGroupTypeOptions } from "@/lib/herd/constants";

const initialState: HerdGroupActionState = {};

export function CreateAnimalGroupForm() {
  const [state, formAction] = useActionState(createAnimalGroupAction, initialState);

  return (
    <form action={formAction} className="grid gap-3">
      <FormFieldShell label="Group name">
        <Input
          name="name"
          placeholder="Cow-calf pairs - Spring 2026"
          required
        />
      </FormFieldShell>

      <FormFieldShell label="Group type">
        <select
          name="groupType"
          defaultValue="management"
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          {animalGroupTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormFieldShell>

      <FormFieldShell label="Description (optional)">
        <Input
          name="description"
          placeholder="Main cow-calf herd for rotation planning."
        />
      </FormFieldShell>

      <FormFieldShell label="Notes (optional)">
        <Textarea
          name="notes"
          placeholder="Any management context for this herd group."
          className="min-h-20"
        />
      </FormFieldShell>

      <div className="flex flex-col gap-2">
        {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
        {state.success ? <p className="text-sm font-medium text-accent">{state.success}</p> : null}
        <SubmitButton
          label="Create herd group"
          pendingLabel="Creating group..."
          className="w-full md:w-fit"
        />
      </div>
    </form>
  );
}

