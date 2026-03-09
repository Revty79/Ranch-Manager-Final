"use client";

import { useActionState } from "react";
import { claimBetaLifetimeAccessAction, type BillingActionState } from "@/lib/billing/actions";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/auth/submit-button";

const initialState: BillingActionState = {};

export function BetaCodeForm() {
  const [state, formAction] = useActionState(
    claimBetaLifetimeAccessAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-2">
      <Input name="code" placeholder="Enter beta lifetime code" />
      {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
      {state.success ? (
        <p className="text-sm font-medium text-accent">{state.success}</p>
      ) : null}
      <SubmitButton
        label="Apply beta access code"
        pendingLabel="Applying code..."
        className="w-full sm:w-fit"
      />
    </form>
  );
}
