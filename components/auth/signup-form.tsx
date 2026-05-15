"use client";

import { useActionState, useState } from "react";
import { signupAction, type AuthActionState } from "@/lib/auth/actions";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "./submit-button";

const initialState: AuthActionState = {};
const USERNAME_PATTERN = "^[a-z0-9._-]{3,40}$";

interface SignupDraftState {
  fullName: string;
  username: string;
  email: string;
  password: string;
}

export function SignupForm() {
  const [draft, setDraft] = useState<SignupDraftState>({
    fullName: "",
    username: "",
    email: "",
    password: "",
  });
  const [clientError, setClientError] = useState<string | null>(null);
  const [state, formAction] = useActionState(signupAction, initialState);

  return (
    <form
      action={formAction}
      className="space-y-4"
      onSubmit={(event) => {
        if (draft.password.length < 8) {
          event.preventDefault();
          setClientError("Password must be at least 8 characters.");
          return;
        }

        if (!new RegExp(USERNAME_PATTERN).test(draft.username.trim().toLowerCase())) {
          event.preventDefault();
          setClientError("Username must be 3-40 letters, numbers, dots, dashes, or underscores.");
          return;
        }

        setClientError(null);
      }}
    >
      <FormFieldShell label="Full name">
        <Input
          name="fullName"
          placeholder="Casey Rivers"
          autoComplete="name"
          value={draft.fullName}
          onChange={(event) =>
            setDraft((current) => ({ ...current, fullName: event.target.value }))
          }
          required
        />
      </FormFieldShell>
      <FormFieldShell
        label="Username"
        hint="Use 3-40 letters, numbers, dots, dashes, or underscores."
      >
        <Input
          name="username"
          placeholder="casey-rivers"
          autoComplete="username"
          minLength={3}
          maxLength={40}
          pattern={USERNAME_PATTERN}
          value={draft.username}
          onChange={(event) =>
            setDraft((current) => ({ ...current, username: event.target.value }))
          }
          required
        />
      </FormFieldShell>
      <FormFieldShell label="Email">
        <Input
          name="email"
          type="email"
          placeholder="casey@ranch.com"
          autoComplete="email"
          value={draft.email}
          onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
          required
        />
      </FormFieldShell>
      <FormFieldShell label="Password" hint="Use at least 8 characters.">
        <Input
          name="password"
          type="password"
          placeholder="Create a password"
          autoComplete="new-password"
          minLength={8}
          value={draft.password}
          onChange={(event) =>
            setDraft((current) => ({ ...current, password: event.target.value }))
          }
          required
        />
      </FormFieldShell>
      {clientError ? <p className="text-sm font-medium text-danger">{clientError}</p> : null}
      {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
      <SubmitButton label="Create account" pendingLabel="Creating account..." className="w-full" />
    </form>
  );
}
