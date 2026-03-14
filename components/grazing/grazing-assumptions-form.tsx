"use client";

import { useActionState, useMemo } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  updateGrazingAssumptionsAction,
  type GrazingActionState,
} from "@/lib/grazing/actions";
import type { GrazingAssumptions } from "@/lib/grazing/settings";

const initialState: GrazingActionState = {};

interface GrazingAssumptionsFormProps {
  assumptions: GrazingAssumptions;
}

export function GrazingAssumptionsForm({ assumptions }: GrazingAssumptionsFormProps) {
  const [state, formAction] = useActionState(updateGrazingAssumptionsAction, initialState);
  const classMultiplierText = useMemo(() => {
    return Object.entries(assumptions.classMultipliers)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");
  }, [assumptions.classMultipliers]);

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2">
      <FormFieldShell label="Planning demand basis">
        <Input
          name="planningDemandBasis"
          defaultValue={assumptions.planningDemandBasis}
          required
        />
      </FormFieldShell>
      <FormFieldShell label="Demand lbs per animal unit / day">
        <Input
          name="demandLbsPerAnimalUnitDay"
          type="number"
          min="0.01"
          step="0.01"
          defaultValue={assumptions.demandLbsPerAnimalUnitDay}
          required
        />
      </FormFieldShell>

      <FormFieldShell label="Default utilization %">
        <Input
          name="defaultUtilizationPercent"
          type="number"
          min="1"
          max="100"
          step="1"
          defaultValue={assumptions.defaultUtilizationPercent}
          required
        />
      </FormFieldShell>
      <FormFieldShell label="Default rest days">
        <Input
          name="defaultRestDays"
          type="number"
          min="0"
          step="1"
          defaultValue={assumptions.defaultRestDays}
          required
        />
      </FormFieldShell>

      <FormFieldShell label="Cattle multiplier">
        <Input
          name="cattleMultiplier"
          type="number"
          min="0.01"
          step="0.01"
          defaultValue={assumptions.speciesMultipliers.cattle}
          required
        />
      </FormFieldShell>
      <FormFieldShell label="Horse multiplier">
        <Input
          name="horseMultiplier"
          type="number"
          min="0.01"
          step="0.01"
          defaultValue={assumptions.speciesMultipliers.horse}
          required
        />
      </FormFieldShell>

      <FormFieldShell label="Other-species multiplier">
        <Input
          name="otherMultiplier"
          type="number"
          min="0.01"
          step="0.01"
          defaultValue={assumptions.speciesMultipliers.other}
          required
        />
      </FormFieldShell>
      <div />

      <div className="md:col-span-2">
        <FormFieldShell
          label="Class overrides (optional)"
          hint="One per line, format `class=value` (example: `calf=0.6`)."
        >
          <Textarea
            name="classMultipliersText"
            defaultValue={classMultiplierText}
            className="min-h-24"
          />
        </FormFieldShell>
      </div>

      <div className="md:col-span-2 flex flex-col gap-2">
        {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
        {state.success ? <p className="text-sm font-medium text-accent">{state.success}</p> : null}
        <SubmitButton
          label="Save assumptions"
          pendingLabel="Saving assumptions..."
          className="w-full md:w-fit"
        />
      </div>
    </form>
  );
}
