"use client";

import { useActionState } from "react";
import {
  createTeamMemberAction,
  type TeamActionState,
} from "@/lib/team/actions";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/auth/submit-button";

const initialState: TeamActionState = {};

export function AddMemberForm() {
  const [state, formAction] = useActionState(createTeamMemberAction, initialState);

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2">
      <FormFieldShell label="Full name">
        <Input name="fullName" placeholder="Jordan Wells" required />
      </FormFieldShell>
      <FormFieldShell label="Email">
        <Input name="email" type="email" placeholder="jordan@ranch.com" required />
      </FormFieldShell>
      <FormFieldShell
        label="Temporary password"
        hint="Required for a new login. Ignored if user already exists."
      >
        <Input name="tempPassword" type="password" placeholder="At least 8 characters" />
      </FormFieldShell>
      <FormFieldShell label="Role">
        <select
          name="role"
          defaultValue="worker"
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="worker">Regular Worker</option>
          <option value="seasonal_worker">Seasonal Worker</option>
          <option value="manager">Manager</option>
          <option value="owner">Owner</option>
        </select>
      </FormFieldShell>
      <FormFieldShell label="Pay type">
        <select
          name="payType"
          defaultValue="hourly"
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="hourly">Hourly</option>
          <option value="salary">Salary</option>
          <option value="piece_work">Piece Work (work-order hours only)</option>
        </select>
      </FormFieldShell>
      <FormFieldShell label="Pay rate">
        <Input name="payRate" type="number" step="0.01" min="0" defaultValue="0" required />
      </FormFieldShell>
      <div className="md:col-span-2 flex flex-col gap-2">
        {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
        {state.success ? (
          <p className="text-sm font-medium text-accent">{state.success}</p>
        ) : null}
        <SubmitButton
          label="Add member"
          pendingLabel="Adding member..."
          className="w-full md:w-fit"
        />
      </div>
    </form>
  );
}
