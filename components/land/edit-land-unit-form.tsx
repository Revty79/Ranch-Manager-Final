"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateLandUnitAction, type LandActionState } from "@/lib/land/actions";
import { landUnitTypeOptions } from "@/lib/land/constants";
import type { LandUnitProfile } from "@/lib/land/queries";

const initialState: LandActionState = {};

interface EditLandUnitFormProps {
  landUnit: LandUnitProfile["landUnit"];
}

export function EditLandUnitForm({ landUnit }: EditLandUnitFormProps) {
  const [state, formAction] = useActionState(updateLandUnitAction, initialState);

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2">
      <input type="hidden" name="landUnitId" value={landUnit.id} />

      <FormFieldShell label="Name">
        <Input name="name" defaultValue={landUnit.name} required />
      </FormFieldShell>
      <FormFieldShell label="Code">
        <Input name="code" defaultValue={landUnit.code ?? ""} />
      </FormFieldShell>

      <FormFieldShell label="Unit type">
        <select
          name="unitType"
          defaultValue={landUnit.unitType}
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
          defaultValue={landUnit.isActive ? "active" : "inactive"}
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </FormFieldShell>

      <FormFieldShell label="Acreage">
        <Input name="acreage" type="number" min="0" step="0.01" defaultValue={landUnit.acreage ?? ""} />
      </FormFieldShell>
      <FormFieldShell label="Grazeable acreage">
        <Input
          name="grazeableAcreage"
          type="number"
          min="0"
          step="0.01"
          defaultValue={landUnit.grazeableAcreage ?? ""}
        />
      </FormFieldShell>

      <FormFieldShell
        label="Estimated forage lbs/acre"
        hint="Planning estimate input, not measured carrying capacity."
      >
        <Input
          name="estimatedForageLbsPerAcre"
          type="number"
          min="0"
          step="0.01"
          defaultValue={landUnit.estimatedForageLbsPerAcre ?? ""}
        />
      </FormFieldShell>
      <FormFieldShell label="Target utilization %">
        <Input
          name="targetUtilizationPercent"
          type="number"
          min="1"
          max="100"
          step="1"
          defaultValue={landUnit.targetUtilizationPercent ?? ""}
        />
      </FormFieldShell>

      <FormFieldShell label="Target rest days">
        <Input
          name="targetRestDays"
          type="number"
          min="0"
          step="1"
          defaultValue={landUnit.targetRestDays ?? ""}
        />
      </FormFieldShell>
      <FormFieldShell label="Seasonal notes">
        <Input name="seasonalNotes" defaultValue={landUnit.seasonalNotes ?? ""} />
      </FormFieldShell>

      <FormFieldShell label="Water source summary">
        <Input name="waterSummary" defaultValue={landUnit.waterSummary ?? ""} />
      </FormFieldShell>
      <FormFieldShell label="Fencing / condition summary">
        <Input name="fencingSummary" defaultValue={landUnit.fencingSummary ?? ""} />
      </FormFieldShell>

      <div className="md:col-span-2">
        <FormFieldShell label="Notes">
          <Textarea name="notes" defaultValue={landUnit.notes ?? ""} />
        </FormFieldShell>
      </div>

      <div className="md:col-span-2 flex flex-col gap-2">
        {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
        {state.success ? <p className="text-sm font-medium text-accent">{state.success}</p> : null}
        <SubmitButton
          label="Save land unit"
          pendingLabel="Saving changes..."
          className="w-full md:w-fit"
        />
      </div>
    </form>
  );
}
