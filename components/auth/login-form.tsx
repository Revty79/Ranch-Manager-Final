"use client";

import { useActionState } from "react";
import { loginAction, type AuthActionState } from "@/lib/auth/actions";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "./submit-button";

const initialState: AuthActionState = {};

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <FormFieldShell label="Email">
        <Input name="email" type="email" placeholder="you@ranch.com" required />
      </FormFieldShell>
      <FormFieldShell label="Password">
        <Input name="password" type="password" placeholder="Your password" required />
      </FormFieldShell>
      {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
      <SubmitButton label="Log in" pendingLabel="Logging in..." className="w-full" />
    </form>
  );
}
