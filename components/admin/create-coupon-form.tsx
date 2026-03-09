"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { createCouponAction, type AdminActionState } from "@/lib/admin/actions";

const initialState: AdminActionState = {};

export function CreateCouponForm() {
  const [state, formAction] = useActionState(createCouponAction, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="grantType" value="beta_lifetime_access" />
      <div className="grid gap-3 md:grid-cols-2">
        <Input name="name" placeholder="Early beta lifetime" required />
        <Input name="code" placeholder="RANCH-BETA-2026" required />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Input
          name="maxRedemptions"
          type="number"
          min="1"
          step="1"
          placeholder="Max redemptions (optional)"
        />
        <Input name="expiresAt" type="datetime-local" />
      </div>
      {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
      {state.success ? <p className="text-sm font-medium text-accent">{state.success}</p> : null}
      <SubmitButton
        label="Create coupon"
        pendingLabel="Creating coupon..."
        className="w-full sm:w-fit"
      />
    </form>
  );
}
