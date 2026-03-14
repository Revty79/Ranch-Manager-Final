"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createProtocolTemplateAction,
  type HerdRecordActionState,
} from "@/lib/herd/records-actions";
import {
  animalSexOptions,
  animalSpeciesOptions,
  protocolTypeOptions,
} from "@/lib/herd/constants";

const initialState: HerdRecordActionState = {};

export function ProtocolTemplateForm() {
  const [state, formAction] = useActionState(createProtocolTemplateAction, initialState);

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2">
      <FormFieldShell label="Template name">
        <Input name="name" placeholder="Cow herd spring vaccine cadence" required />
      </FormFieldShell>
      <FormFieldShell label="Protocol type">
        <select
          name="protocolType"
          defaultValue="vaccination"
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          {protocolTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormFieldShell>

      <FormFieldShell label="Species scope">
        <select
          name="species"
          defaultValue="all"
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          <option value="all">All species</option>
          {animalSpeciesOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormFieldShell>
      <FormFieldShell label="Sex scope">
        <select
          name="sex"
          defaultValue="all"
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          <option value="all">All</option>
          {animalSexOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormFieldShell>

      <FormFieldShell label="Interval days">
        <Input name="intervalDays" type="number" min="1" defaultValue="90" required />
      </FormFieldShell>
      <FormFieldShell label="Due-soon threshold (days)">
        <Input name="dueSoonDays" type="number" min="0" defaultValue="14" required />
      </FormFieldShell>

      <div className="md:col-span-2">
        <FormFieldShell
          label="Notes"
          hint="These are ranch-configurable operational reminders. Align final protocol decisions with your veterinarian and management team."
        >
          <Textarea name="notes" placeholder="Protocol assumptions and caveats for this ranch." />
        </FormFieldShell>
      </div>

      <div className="md:col-span-2 flex flex-col gap-2">
        {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
        {state.success ? <p className="text-sm font-medium text-accent">{state.success}</p> : null}
        <SubmitButton
          label="Add protocol template"
          pendingLabel="Saving template..."
          className="w-full md:w-fit"
        />
      </div>
    </form>
  );
}
