"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  updateEquipmentAction,
  type EquipmentActionState,
} from "@/lib/equipment/actions";
import {
  equipmentStatusOptions,
  equipmentTypeOptions,
} from "@/lib/equipment/constants";
import type { EquipmentDetail } from "@/lib/equipment/queries";

const initialState: EquipmentActionState = {};

interface EditEquipmentFormProps {
  equipment: EquipmentDetail["equipment"];
}

export function EditEquipmentForm({ equipment }: EditEquipmentFormProps) {
  const [state, formAction] = useActionState(updateEquipmentAction, initialState);

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2">
      <input type="hidden" name="equipmentId" value={equipment.id} />

      <FormFieldShell label="Name">
        <Input name="name" defaultValue={equipment.name} required />
      </FormFieldShell>
      <FormFieldShell label="Type">
        <select
          name="equipmentType"
          defaultValue={equipment.equipmentType}
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
          defaultValue={equipment.status}
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
        <Input name="identifier" defaultValue={equipment.identifier ?? ""} />
      </FormFieldShell>

      <FormFieldShell label="Make">
        <Input name="make" defaultValue={equipment.make ?? ""} />
      </FormFieldShell>
      <FormFieldShell label="Model">
        <Input name="model" defaultValue={equipment.model ?? ""} />
      </FormFieldShell>

      <FormFieldShell label="Year">
        <Input
          name="year"
          type="number"
          min="1900"
          max="2200"
          step="1"
          defaultValue={equipment.year ?? ""}
        />
      </FormFieldShell>
      <FormFieldShell label="Plate / VIN">
        <Input name="plateVin" defaultValue={equipment.plateVin ?? ""} />
      </FormFieldShell>

      <FormFieldShell label="Serial number">
        <Input name="serialNumber" defaultValue={equipment.serialNumber ?? ""} />
      </FormFieldShell>
      <FormFieldShell label="Current location">
        <Input name="currentLocation" defaultValue={equipment.currentLocation ?? ""} />
      </FormFieldShell>

      <div className="md:col-span-2">
        <FormFieldShell label="Notes">
          <Textarea name="notes" defaultValue={equipment.notes ?? ""} />
        </FormFieldShell>
      </div>

      <div className="md:col-span-2 flex flex-col gap-2">
        {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
        {state.success ? (
          <p className="text-sm font-medium text-accent">{state.success}</p>
        ) : null}
        <SubmitButton
          label="Save equipment"
          pendingLabel="Saving equipment..."
          className="w-full md:w-fit"
        />
      </div>
    </form>
  );
}

