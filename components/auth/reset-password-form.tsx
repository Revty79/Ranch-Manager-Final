"use client";

import { useActionState } from "react";
import { resetPasswordAction, type AuthActionState } from "@/lib/auth/actions";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "./submit-button";

const initialState: AuthActionState = {};

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(resetPasswordAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <FormFieldShell label="New password" hint="Use at least 8 characters.">
        <Input
          name="newPassword"
          type="password"
          placeholder="Create a new password"
          required
          minLength={8}
        />
      </FormFieldShell>
      <FormFieldShell label="Confirm new password">
        <Input
          name="confirmPassword"
          type="password"
          placeholder="Re-enter your new password"
          required
          minLength={8}
        />
      </FormFieldShell>
      {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
      <SubmitButton
        label="Save new password"
        pendingLabel="Saving password..."
        className="w-full"
      />
    </form>
  );
}
