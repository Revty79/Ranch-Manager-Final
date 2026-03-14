"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  recordBreedingEventAction,
  type HerdRecordActionState,
} from "@/lib/herd/records-actions";
import { pregnancyOutcomeOptions } from "@/lib/herd/constants";
import type { AnimalReferenceOption } from "@/lib/herd/queries";

const initialState: HerdRecordActionState = {};

interface BreedingRecordFormProps {
  animalId: string;
  animalOptions: AnimalReferenceOption[];
}

export function BreedingRecordForm({ animalId, animalOptions }: BreedingRecordFormProps) {
  const [state, formAction] = useActionState(recordBreedingEventAction, initialState);

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2">
      <input type="hidden" name="animalId" value={animalId} />

      <FormFieldShell label="Service date">
        <Input name="serviceDate" type="date" />
      </FormFieldShell>
      <FormFieldShell label="Expected birth date">
        <Input name="expectedBirthDate" type="date" />
      </FormFieldShell>

      <FormFieldShell label="Service-window start (optional)">
        <Input name="serviceWindowStart" type="date" />
      </FormFieldShell>
      <FormFieldShell label="Service-window end (optional)">
        <Input name="serviceWindowEnd" type="date" />
      </FormFieldShell>

      <FormFieldShell label="Sire / bull / stallion (optional)">
        <select
          name="sireAnimalId"
          defaultValue=""
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          <option value="">Unknown / not linked</option>
          {animalOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </FormFieldShell>

      <FormFieldShell label="Breeding method">
        <select
          name="breedingMethod"
          defaultValue="natural_service"
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          <option value="natural_service">Natural service</option>
          <option value="ai">Artificial insemination</option>
          <option value="embryo_transfer">Embryo transfer</option>
          <option value="unknown">Unknown</option>
        </select>
      </FormFieldShell>

      <FormFieldShell label="Current outcome state">
        <select
          name="outcome"
          defaultValue="bred"
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          {pregnancyOutcomeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormFieldShell>

      <FormFieldShell label="Offspring linkage (optional)">
        <select
          name="offspringAnimalId"
          defaultValue=""
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          <option value="">Not linked yet</option>
          {animalOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </FormFieldShell>

      <div className="md:col-span-2">
        <FormFieldShell label="Notes">
          <Textarea
            name="notes"
            placeholder="Service notes, observations, planning notes."
          />
        </FormFieldShell>
      </div>

      <div className="md:col-span-2 flex flex-col gap-2">
        {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
        {state.success ? <p className="text-sm font-medium text-accent">{state.success}</p> : null}
        <SubmitButton label="Record breeding event" pendingLabel="Recording..." className="w-full md:w-fit" />
      </div>
    </form>
  );
}
