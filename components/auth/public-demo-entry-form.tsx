"use client";

import { useActionState } from "react";
import { startPublicDemoSessionAction, type AuthActionState } from "@/lib/auth/actions";
import { SubmitButton } from "./submit-button";

const initialState: AuthActionState = {};

export function PublicDemoEntryForm() {
  const [state, formAction] = useActionState(startPublicDemoSessionAction, initialState);

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
      <SubmitButton
        label="Enter Demo Ranch"
        pendingLabel="Opening demo ranch..."
        className="w-full"
      />
    </form>
  );
}
