"use client";

import { useActionState } from "react";
import {
  createCustomerPortalSessionAction,
  type BillingActionState,
} from "@/lib/billing/actions";
import { SubmitButton } from "@/components/auth/submit-button";

const initialState: BillingActionState = {};

interface CustomerPortalFormProps {
  label?: string;
  pendingLabel?: string;
}

export function CustomerPortalForm({
  label = "Manage or cancel in Stripe",
  pendingLabel = "Opening customer portal...",
}: CustomerPortalFormProps) {
  const [state, formAction] = useActionState(
    createCustomerPortalSessionAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-2">
      {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
      <SubmitButton
        label={label}
        pendingLabel={pendingLabel}
        className="w-full sm:w-fit"
      />
    </form>
  );
}
