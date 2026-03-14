"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  recordHealthEventAction,
  type HerdRecordActionState,
} from "@/lib/herd/records-actions";
import { healthRecordTypeOptions } from "@/lib/herd/constants";

const initialState: HerdRecordActionState = {};

interface HealthRecordFormProps {
  animalId: string;
}

export function HealthRecordForm({ animalId }: HealthRecordFormProps) {
  const [state, formAction] = useActionState(recordHealthEventAction, initialState);

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2">
      <input type="hidden" name="animalId" value={animalId} />

      <FormFieldShell label="Record date">
        <Input name="recordDate" type="date" />
      </FormFieldShell>
      <FormFieldShell label="Record type">
        <select
          name="healthRecordType"
          defaultValue="vaccination"
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          {healthRecordTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormFieldShell>

      <FormFieldShell label="Product / procedure summary">
        <Input name="productOrProcedure" placeholder="7-way clostridial booster, lameness exam..." required />
      </FormFieldShell>
      <FormFieldShell label="Lot / batch / serial (optional)">
        <Input name="lotSerial" placeholder="LOT 42A" />
      </FormFieldShell>

      <FormFieldShell label="Withdrawal / hold note (optional)">
        <Input name="withdrawalNote" placeholder="Hold from market through Sept 12" />
      </FormFieldShell>
      <div />

      <div className="md:col-span-2">
        <FormFieldShell label="Notes">
          <Textarea name="notes" placeholder="Practical treatment notes and context." />
        </FormFieldShell>
      </div>

      <div className="md:col-span-2 flex flex-col gap-2">
        {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
        {state.success ? <p className="text-sm font-medium text-accent">{state.success}</p> : null}
        <SubmitButton label="Record health event" pendingLabel="Recording..." className="w-full md:w-fit" />
      </div>
    </form>
  );
}
