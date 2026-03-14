"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createAnimalAction, type HerdActionState } from "@/lib/herd/actions";
import {
  animalSexOptions,
  animalSpeciesOptions,
} from "@/lib/herd/constants";
import type { AnimalReferenceOption } from "@/lib/herd/queries";

const initialState: HerdActionState = {};

interface CreateAnimalFormProps {
  parentOptions: AnimalReferenceOption[];
}

export function CreateAnimalForm({ parentOptions }: CreateAnimalFormProps) {
  const [state, formAction] = useActionState(createAnimalAction, initialState);

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2">
      <FormFieldShell label="Tag / visual ID">
        <Input name="tagId" placeholder="A-1042" required />
      </FormFieldShell>
      <FormFieldShell
        label="Internal ID"
        hint="Ranch-only operational ID (ear tag, lot ID, or office ledger ID)."
      >
        <Input name="internalId" placeholder="2026-HEIFER-12" required />
      </FormFieldShell>

      <FormFieldShell label="Display name (optional)">
        <Input name="displayName" placeholder="Bluebell" />
      </FormFieldShell>
      <FormFieldShell label="Alternate / official ID (optional)">
        <Input name="alternateId" placeholder="USDA or association ID" />
      </FormFieldShell>

      <FormFieldShell label="Species">
        <select
          name="species"
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
      <FormFieldShell label="Sex">
        <select
          name="sex"
          defaultValue="female"
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          {animalSexOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormFieldShell>

      <FormFieldShell label="Class / category">
        <Input name="animalClass" placeholder="Cow, heifer, bull, mare, gelding..." />
      </FormFieldShell>
      <FormFieldShell label="Breed">
        <Input name="breed" placeholder="Angus, Hereford, Quarter Horse..." />
      </FormFieldShell>

      <FormFieldShell label="Color / markings (optional)">
        <Input name="colorMarkings" placeholder="Black, white face, left ear notch..." />
      </FormFieldShell>
      <FormFieldShell label="Birth date">
        <Input name="birthDate" type="date" />
      </FormFieldShell>

      <FormFieldShell
        label="Sire (optional)"
        hint="Internal lineage reference only. No advanced pedigree tooling in this phase."
      >
        <select name="sireAnimalId" defaultValue="" className="h-10 w-full rounded-xl border bg-surface px-3 text-sm">
          <option value="">Unknown / not set</option>
          {parentOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </FormFieldShell>
      <FormFieldShell label="Dam (optional)">
        <select name="damAnimalId" defaultValue="" className="h-10 w-full rounded-xl border bg-surface px-3 text-sm">
          <option value="">Unknown / not set</option>
          {parentOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </FormFieldShell>

      <FormFieldShell label="Acquisition date (optional)">
        <Input name="acquiredOn" type="date" />
      </FormFieldShell>
      <FormFieldShell label="Acquisition source (optional)">
        <Input name="acquisitionSource" placeholder="Raised on ranch, neighbor ranch, auction..." />
      </FormFieldShell>

      <FormFieldShell label="Acquisition method (optional)">
        <Input name="acquisitionMethod" placeholder="Purchased, raised, gifted, transfer..." />
      </FormFieldShell>
      <FormFieldShell label="Birth date confidence">
        <div className="flex h-10 items-center gap-2 rounded-xl border bg-surface px-3 text-sm">
          <input id="isBirthDateEstimated" name="isBirthDateEstimated" type="checkbox" value="true" />
          <label htmlFor="isBirthDateEstimated">Birth date is estimated</label>
        </div>
      </FormFieldShell>

      <div className="md:col-span-2">
        <FormFieldShell label="Operational notes (optional)">
          <Textarea
            name="notes"
            placeholder="Temperament, handling notes, or quick operational context."
          />
        </FormFieldShell>
      </div>

      <div className="md:col-span-2 flex flex-col gap-2">
        {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
        {state.success ? <p className="text-sm font-medium text-accent">{state.success}</p> : null}
        <SubmitButton label="Add animal" pendingLabel="Saving animal..." className="w-full md:w-fit" />
      </div>
    </form>
  );
}
