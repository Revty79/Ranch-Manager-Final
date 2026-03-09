"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  toggleTeamMemberStatusAction,
  type TeamActionState,
  updateTeamMemberAction,
} from "@/lib/team/actions";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/auth/submit-button";
import { Button } from "@/components/ui/button";

interface EditMemberFormProps {
  membershipId: string;
  fullName: string;
  role: "owner" | "manager" | "worker" | "Seasonal";
  payType: "hourly" | "salary" | "piecework";
  payRateCents: number;
  isActive: boolean;
}

const initialState: TeamActionState = {};

export function EditMemberForm({
  membershipId,
  fullName,
  role,
  payType,
  payRateCents,
  isActive,
}: EditMemberFormProps) {
  const router = useRouter();
  const [updateState, updateAction] = useActionState(updateTeamMemberAction, initialState);
  const [toggleState, toggleAction] = useActionState(
    toggleTeamMemberStatusAction,
    initialState,
  );

  useEffect(() => {
    if (updateState.success || toggleState.success) {
      router.refresh();
    }
  }, [router, toggleState.success, updateState.success]);

  return (
    <div className="space-y-6">
      <form action={updateAction} className="grid gap-3 md:grid-cols-2">
        <input type="hidden" name="membershipId" value={membershipId} />
        <FormFieldShell label="Full name">
          <Input name="fullName" defaultValue={fullName} required />
        </FormFieldShell>
        <FormFieldShell label="Role">
          <select
            name="role"
            defaultValue={role}
            className="h-10 w-full rounded-xl border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="worker">Worker</option>
            <option value="manager">Manager</option>
            <option value="owner">Owner</option>
          </select>
        </FormFieldShell>
        <FormFieldShell label="Pay type">
          <select
            name="payType"
            defaultValue={payType}
            className="h-10 w-full rounded-xl border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="hourly">Hourly</option>
            <option value="salary">Salary</option>
          </select>
        </FormFieldShell>
        <FormFieldShell label="Pay rate">
          <Input
            name="payRate"
            type="number"
            step="0.01"
            min="0"
            defaultValue={(payRateCents / 100).toFixed(2)}
            required
          />
        </FormFieldShell>
        <div className="md:col-span-2 flex flex-col gap-2">
          {updateState.error ? (
            <p className="text-sm font-medium text-danger">{updateState.error}</p>
          ) : null}
          {updateState.success ? (
            <p className="text-sm font-medium text-accent">{updateState.success}</p>
          ) : null}
          <SubmitButton label="Save changes" pendingLabel="Saving..." className="w-full md:w-fit" />
        </div>
      </form>

      <form action={toggleAction} className="space-y-2">
        <input type="hidden" name="membershipId" value={membershipId} />
        <input type="hidden" name="setActive" value={isActive ? "false" : "true"} />
        {toggleState.error ? (
          <p className="text-sm font-medium text-danger">{toggleState.error}</p>
        ) : null}
        {toggleState.success ? (
          <p className="text-sm font-medium text-accent">{toggleState.success}</p>
        ) : null}
        <Button variant={isActive ? "danger" : "secondary"} type="submit">
          {isActive ? "Deactivate member" : "Activate member"}
        </Button>
      </form>
    </div>
  );
}
