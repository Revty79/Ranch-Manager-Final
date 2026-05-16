"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Input } from "@/components/ui/input";
import { animalSpeciesOptions } from "@/lib/herd/constants";
import {
  removeAnimalsBySpeciesFromLandUnitAction,
  type LandActionState,
} from "@/lib/land/actions";

const initialState: LandActionState = {};

interface RemoveSpeciesFromUnitFormProps {
  landUnitId: string;
  animalClassOptions: string[];
}

export function RemoveSpeciesFromUnitForm({
  landUnitId,
  animalClassOptions,
}: RemoveSpeciesFromUnitFormProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    removeAnimalsBySpeciesFromLandUnitAction,
    initialState,
  );

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [router, state.success]);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="landUnitId" value={landUnitId} />

      <FormFieldShell label="Species">
        <select
          name="species"
          required
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

      <FormFieldShell label="Class filter (optional)">
        <select
          name="animalClass"
          defaultValue=""
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          <option value="">All classes in selected species</option>
          {animalClassOptions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </FormFieldShell>

      <FormFieldShell label="Notes (optional)">
        <Input
          name="notes"
          placeholder="Example: Removed bulls from this pen after processing."
        />
      </FormFieldShell>

      {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
      {state.success ? <p className="text-sm font-medium text-accent">{state.success}</p> : null}

      <SubmitButton
        label="Remove by species from this unit"
        pendingLabel="Removing animals..."
        className="w-full md:w-fit"
      />
    </form>
  );
}

