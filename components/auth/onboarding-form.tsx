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
      {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
      <SubmitButton label="Create ranch workspace" pendingLabel="Creating workspace..." />
    </form>
  );
}
