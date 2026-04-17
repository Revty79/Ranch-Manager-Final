"use client";

import Image from "next/image";
import { useActionState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateAnimalAction, type HerdActionState } from "@/lib/herd/actions";
import {
  animalSexOptions,
  animalSpeciesOptions,
  animalStatusOptions,
} from "@/lib/herd/constants";
import type { AnimalDetailRecord, AnimalReferenceOption } from "@/lib/herd/queries";

const initialState: HerdActionState = {};

interface EditAnimalFormProps {
  animal: AnimalDetailRecord;
  parentOptions: AnimalReferenceOption[];
}

export function EditAnimalForm({ animal, parentOptions }: EditAnimalFormProps) {
  const [state, formAction] = useActionState(updateAnimalAction, initialState);

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2">
      <input type="hidden" name="animalId" value={animal.id} />

      <FormFieldShell label="Tag / visual ID">
        <Input name="tagId" defaultValue={animal.tagId} required />
      </FormFieldShell>
      <FormFieldShell label="Internal ID">
        <Input name="internalId" defaultValue={animal.internalId} required />
      </FormFieldShell>

      <FormFieldShell label="Display name">
        <Input name="displayName" defaultValue={animal.displayName ?? ""} />
      </FormFieldShell>
      <FormFieldShell label="Alternate / official ID">
        <Input name="alternateId" defaultValue={animal.alternateId ?? ""} />
      </FormFieldShell>

      <FormFieldShell label="Species">
        <select
          name="species"
          defaultValue={animal.species}
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
          defaultValue={animal.sex}
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
        <Input name="animalClass" defaultValue={animal.animalClass ?? ""} />
      </FormFieldShell>
      <FormFieldShell label="Breed">
        <Input name="breed" defaultValue={animal.breed ?? ""} />
      </FormFieldShell>

      <FormFieldShell label="Color / markings">
        <Input name="colorMarkings" defaultValue={animal.colorMarkings ?? ""} />
      </FormFieldShell>
      <FormFieldShell label="Birth date">
        <Input name="birthDate" type="date" defaultValue={animal.birthDate ?? ""} />
      </FormFieldShell>

      <FormFieldShell label="Current status">
        <select
          name="status"
          defaultValue={animal.status}
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          {animalStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormFieldShell>
      <FormFieldShell label="Birth date confidence">
        <div className="flex h-10 items-center gap-2 rounded-xl border bg-surface px-3 text-sm">
          <input
            id="isBirthDateEstimated"
            name="isBirthDateEstimated"
            type="checkbox"
            value="true"
            defaultChecked={animal.isBirthDateEstimated}
          />
          <label htmlFor="isBirthDateEstimated">Birth date is estimated</label>
        </div>
      </FormFieldShell>

      <FormFieldShell label="Sire">
        <select
          name="sireAnimalId"
          defaultValue={animal.sireAnimalId ?? ""}
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          <option value="">Unknown / not set</option>
          {parentOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </FormFieldShell>
      <FormFieldShell label="Dam">
        <select
          name="damAnimalId"
          defaultValue={animal.damAnimalId ?? ""}
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          <option value="">Unknown / not set</option>
          {parentOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </FormFieldShell>

      <FormFieldShell label="Acquisition date">
        <Input name="acquiredOn" type="date" defaultValue={animal.acquiredOn ?? ""} />
      </FormFieldShell>
      <FormFieldShell label="Acquisition source">
        <Input name="acquisitionSource" defaultValue={animal.acquisitionSource ?? ""} />
      </FormFieldShell>

      <FormFieldShell label="Acquisition method">
        <Input name="acquisitionMethod" defaultValue={animal.acquisitionMethod ?? ""} />
      </FormFieldShell>
      <div />

      <div className="md:col-span-2">
        <FormFieldShell
          label="Newborn calf + mom photo"
          hint="Upload a replacement photo or remove the existing one. JPG, PNG, WEBP up to 5 MB."
        >
          <div className="space-y-3">
            {animal.newbornPairPhotoDataUrl ? (
              <Image
                src={animal.newbornPairPhotoDataUrl}
                alt={`${animal.tagId} calf and dam tracking photo`}
                width={1024}
                height={768}
                unoptimized
                className="h-48 w-full rounded-xl border object-cover md:h-64"
              />
            ) : (
              <p className="rounded-xl border bg-surface px-3 py-2 text-sm text-foreground-muted">
                No calf + mom photo on this record yet.
              </p>
            )}
            <Input
              name="newbornPairPhoto"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
            />
            {animal.newbornPairPhotoDataUrl ? (
              <label className="flex items-center gap-2 text-sm text-foreground-muted">
                <input type="checkbox" name="removeNewbornPairPhoto" value="true" />
                Remove current photo
              </label>
            ) : null}
          </div>
        </FormFieldShell>
      </div>

      <div className="md:col-span-2">
        <FormFieldShell label="Operational notes">
          <Textarea name="notes" defaultValue={animal.notes ?? ""} />
        </FormFieldShell>
      </div>

      <div className="md:col-span-2 flex flex-col gap-2">
        {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
        {state.success ? <p className="text-sm font-medium text-accent">{state.success}</p> : null}
        <SubmitButton
          label="Save animal updates"
          pendingLabel="Saving updates..."
          className="w-full md:w-fit"
        />
      </div>
    </form>
  );
}
