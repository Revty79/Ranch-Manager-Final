"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createEquipmentAction,
  type EquipmentActionState,
} from "@/lib/equipment/actions";
import {
  equipmentStatusOptions,
  equipmentTypeOptions,
} from "@/lib/equipment/constants";

const initialState: EquipmentActionState = {};

export function CreateEquipmentForm() {
  const [state, formAction] = useActionState(createEquipmentAction, initialState);

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2">
      <FormFieldShell label="Name">
        <Input name="name" placeholder="Ranch truck" required />
      </FormFieldShell>
      <FormFieldShell label="Type">
        <select
          name="equipmentType"
          defaultValue="truck"
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          {equipmentTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormFieldShell>

      <FormFieldShell label="Status">
        <select
          name="status"
          defaultValue="active"
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          {equipmentStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormFieldShell>
      <FormFieldShell label="Unit / identifier">
        <Input name="identifier" placeholder="TRK-12" />
      </FormFieldShell>

      <FormFieldShell label="Make">
        <Input name="make" placeholder="Ford" />
      </FormFieldShell>
      <FormFieldShell label="Model">
        <Input name="model" placeholder="F-250" />
      </FormFieldShell>

      <FormFieldShell label="Year">
        <Input name="year" type="number" min="1900" max="2200" step="1" />
      </FormFieldShell>
      <FormFieldShell label="Plate / VIN">
        <Input name="plateVin" placeholder="VIN or plate" />
      </FormFieldShell>

      <FormFieldShell label="Serial number">
        <Input name="serialNumber" />
      </FormFieldShell>
      <FormFieldShell label="Current location">
        <Input name="currentLocation" placeholder="Shop yard" />
      </FormFieldShell>

      <div className="md:col-span-2">
        <FormFieldShell label="Notes">
          <Textarea
            name="notes"
            placeholder="Any operational notes, condition details, or maintenance context."
          />
        </FormFieldShell>
      </div>

      <div className="md:col-span-2 flex flex-col gap-2">
        {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
        {state.success ? (
          <p className="text-sm font-medium text-accent">{state.success}</p>
        ) : null}
        <SubmitButton
          label="Add equipment"
          pendingLabel="Saving equipment..."
          className="w-full md:w-fit"
        />
      </div>
    </form>
  );
}

