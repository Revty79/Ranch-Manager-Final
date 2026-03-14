"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createLandUnitAction, type LandActionState } from "@/lib/land/actions";
import { landUnitTypeOptions } from "@/lib/land/constants";

const initialState: LandActionState = {};

export function CreateLandUnitForm() {
  const [state, formAction] = useActionState(createLandUnitAction, initialState);

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2">
      <FormFieldShell label="Name">
        <Input name="name" placeholder="North Pasture" required />
      </FormFieldShell>
      <FormFieldShell label="Code (optional)">
        <Input name="code" placeholder="NP-1" />
      </FormFieldShell>

      <FormFieldShell label="Unit type">
        <select
          name="unitType"
          defaultValue="pasture"
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          {landUnitTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormFieldShell>
      <FormFieldShell label="Status">
        <select
          name="activityState"
          defaultValue="active"
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </FormFieldShell>

      <FormFieldShell label="Acreage (optional)">
        <Input name="acreage" type="number" min="0" step="0.01" />
      </FormFieldShell>
      <FormFieldShell label="Grazeable acreage (optional)">
        <Input name="grazeableAcreage" type="number" min="0" step="0.01" />
      </FormFieldShell>

      <FormFieldShell
        label="Estimated forage lbs/acre (optional)"
        hint="Planning input only. Use your ranch-specific estimate."
      >
        <Input name="estimatedForageLbsPerAcre" type="number" min="0" step="0.01" />
      </FormFieldShell>
      <FormFieldShell label="Target utilization % (optional)">
        <Input name="targetUtilizationPercent" type="number" min="1" max="100" step="1" />
      </FormFieldShell>

      <FormFieldShell label="Target rest days (optional)">
        <Input name="targetRestDays" type="number" min="0" step="1" />
      </FormFieldShell>
      <FormFieldShell label="Seasonal notes (optional)">
        <Input name="seasonalNotes" placeholder="Spring flush, dry summer, winter hold pattern..." />
      </FormFieldShell>

      <FormFieldShell label="Water source summary">
        <Input name="waterSummary" placeholder="Trough + seasonal creek" />
      </FormFieldShell>
      <FormFieldShell label="Fencing / condition summary">
        <Input name="fencingSummary" placeholder="4-strand barbed, repaired west side" />
      </FormFieldShell>

      <div className="md:col-span-2">
        <FormFieldShell label="Notes">
          <Textarea name="notes" placeholder="Operational notes for this land unit." />
        </FormFieldShell>
      </div>

      <div className="md:col-span-2 flex flex-col gap-2">
        {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
        {state.success ? <p className="text-sm font-medium text-accent">{state.success}</p> : null}
        <SubmitButton label="Add land unit" pendingLabel="Saving land unit..." className="w-full md:w-fit" />
      </div>
    </form>
  );
}
