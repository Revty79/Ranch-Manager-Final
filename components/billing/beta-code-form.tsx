"use client";

import { useActionState } from "react";
import { applyCouponCodeAction, type BillingActionState } from "@/lib/billing/actions";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/auth/submit-button";

const initialState: BillingActionState = {};

export function CouponCodeForm() {
  const [state, formAction] = useActionState(
    applyCouponCodeAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-2">
      <Input name="code" placeholder="Enter coupon code" />
      {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
      {state.success ? (
        <p className="text-sm font-medium text-accent">{state.success}</p>
      ) : null}
      <SubmitButton
        label="Apply coupon code"
        pendingLabel="Applying coupon..."
        className="w-full sm:w-fit"
      />
    </form>
  );
}

export const BetaCodeForm = CouponCodeForm;
