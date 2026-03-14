"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createAnimalEventAction, type HerdActionState } from "@/lib/herd/actions";
import { lifecycleEventOptions } from "@/lib/herd/constants";

const initialState: HerdActionState = {};

interface RecordAnimalEventFormProps {
  animalId: string;
}

export function RecordAnimalEventForm({ animalId }: RecordAnimalEventFormProps) {
  const [state, formAction] = useActionState(createAnimalEventAction, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="animalId" value={animalId} />

      <FormFieldShell
        label="Event type"
        hint="Lifecycle events update current status where applicable."
      >
        <select
          name="eventType"
          defaultValue="note"
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          {lifecycleEventOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormFieldShell>

      <FormFieldShell label="Occurred at">
        <Input name="occurredAt" type="datetime-local" />
      </FormFieldShell>

      <FormFieldShell label="Summary">
        <Input name="summary" placeholder="Optional. A structured default is used if blank." />
      </FormFieldShell>

      <FormFieldShell label="Details (optional)">
        <Textarea name="details" placeholder="Add practical context for this lifecycle event." />
      </FormFieldShell>

      {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
      {state.success ? <p className="text-sm font-medium text-accent">{state.success}</p> : null}
      <SubmitButton label="Record event" pendingLabel="Recording..." className="w-full md:w-fit" />
    </form>
  );
}
