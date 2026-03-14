"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  recordPregnancyCheckAction,
  type HerdRecordActionState,
} from "@/lib/herd/records-actions";
import { pregnancyOutcomeOptions } from "@/lib/herd/constants";

const initialState: HerdRecordActionState = {};

interface PregnancyCheckFormProps {
  animalId: string;
}

export function PregnancyCheckForm({ animalId }: PregnancyCheckFormProps) {
  const [state, formAction] = useActionState(recordPregnancyCheckAction, initialState);

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2">
      <input type="hidden" name="animalId" value={animalId} />

      <FormFieldShell label="Check date">
        <Input name="checkDate" type="date" />
      </FormFieldShell>
      <FormFieldShell label="Outcome">
        <select
          name="outcome"
          defaultValue="unknown"
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          {pregnancyOutcomeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormFieldShell>

      <FormFieldShell label="Expected birth date (optional)">
        <Input name="expectedBirthDate" type="date" />
      </FormFieldShell>
      <div />

      <div className="md:col-span-2">
        <FormFieldShell label="Notes">
          <Textarea name="notes" placeholder="Exam findings or management notes." />
        </FormFieldShell>
      </div>

      <div className="md:col-span-2 flex flex-col gap-2">
        {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
        {state.success ? <p className="text-sm font-medium text-accent">{state.success}</p> : null}
        <SubmitButton
          label="Record pregnancy check"
          pendingLabel="Recording..."
          className="w-full md:w-fit"
        />
      </div>
    </form>
  );
}
