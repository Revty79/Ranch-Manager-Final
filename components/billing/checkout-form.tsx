"use client";

import { useActionState } from "react";
import { createCheckoutSessionAction, type BillingActionState } from "@/lib/billing/actions";
import { SubmitButton } from "@/components/auth/submit-button";

const initialState: BillingActionState = {};

export function CheckoutForm() {
  const [state, formAction] = useActionState(createCheckoutSessionAction, initialState);

  return (
    <form action={formAction} className="space-y-2">
      {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
      <SubmitButton
        label="Start Stripe checkout"
        pendingLabel="Opening checkout..."
        className="w-full sm:w-fit"
      />
    </form>
  );
}
