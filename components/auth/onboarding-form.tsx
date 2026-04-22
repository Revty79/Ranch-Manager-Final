"use client";

import { useActionState } from "react";
import { completeOnboardingAction, type AuthActionState } from "@/lib/auth/actions";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "./submit-button";

const initialState: AuthActionState = {};

export function OnboardingForm() {
  const [state, formAction] = useActionState(completeOnboardingAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <FormFieldShell
        label="Ranch name"
        hint="This name identifies your tenant workspace. You can update it later."
      >
        <Input name="ranchName" placeholder="Willow Creek Ranch" required />
      </FormFieldShell>
      <FormFieldShell
        label="Payroll cadence default"
        hint="Sets your initial payroll settings so reporting and period setup start with practical defaults."
      >
        <select
          name="payrollCadence"
          defaultValue="biweekly"
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="weekly">Weekly (7-day periods)</option>
          <option value="biweekly">Biweekly (14-day periods)</option>
          <option value="monthly">Monthly (30-day periods)</option>
        </select>
      </FormFieldShell>
      <label className="flex items-start gap-2 rounded-xl border bg-surface px-3 py-2 text-sm">
        <input type="checkbox" name="includeStarterTemplates" defaultChecked />
        <span>
          Add starter recurring work-order templates for morning checks, water inspection, and
          weekly fence checks.
        </span>
      </label>
      <p className="rounded-xl border bg-surface px-3 py-2 text-xs text-foreground-muted">
        You will start as owner. Invite managers and workers from Team after setup.
      </p>
      {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
      <SubmitButton label="Create ranch workspace" pendingLabel="Creating workspace..." />
    </form>
  );
}
