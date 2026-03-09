"use client";

import { useActionState } from "react";
import { signupAction, type AuthActionState } from "@/lib/auth/actions";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "./submit-button";

const initialState: AuthActionState = {};

export function SignupForm() {
  const [state, formAction] = useActionState(signupAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <FormFieldShell label="Full name">
        <Input name="fullName" placeholder="Casey Rivers" required />
      </FormFieldShell>
      <FormFieldShell label="Email">
        <Input name="email" type="email" placeholder="casey@ranch.com" required />
      </FormFieldShell>
      <FormFieldShell label="Password" hint="Use at least 8 characters.">
        <Input name="password" type="password" placeholder="Create a password" required />
      </FormFieldShell>
      {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
      <SubmitButton label="Create account" pendingLabel="Creating account..." className="w-full" />
    </form>
  );
}
