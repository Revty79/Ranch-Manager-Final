"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  deleteTeamMemberAction,
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
  role: "owner" | "manager" | "worker" | "seasonal_worker";
  payType: "hourly" | "salary" | "piece_work";
  payRateCents: number;
  payAdvanceCents: number;
  isActive: boolean;
}

const initialState: TeamActionState = {};

export function EditMemberForm({
  membershipId,
  fullName,
  role,
  payType,
  payRateCents,
  payAdvanceCents,
  isActive,
}: EditMemberFormProps) {
  const router = useRouter();
  const [updateState, updateAction] = useActionState(updateTeamMemberAction, initialState);
  const [toggleState, toggleAction] = useActionState(
    toggleTeamMemberStatusAction,
    initialState,
  );
  const [deleteState, deleteAction] = useActionState(deleteTeamMemberAction, initialState);

  useEffect(() => {
    if (deleteState.success) {
      router.push("/app/team");
      return;
    }

    if (updateState.success || toggleState.success) {
      router.refresh();
    }
  }, [deleteState.success, router, toggleState.success, updateState.success]);

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
            <option value="worker">Regular Worker</option>
            <option value="seasonal_worker">Seasonal Worker</option>
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
            <option value="piece_work">Piece Work (work-order hours only)</option>
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
        <FormFieldShell
          label="Opening advance balance"
          hint="Starting balance that carries into payroll period rollover calculations."
        >
          <Input
            name="payAdvance"
            type="number"
            step="0.01"
            min="0"
            defaultValue={(payAdvanceCents / 100).toFixed(2)}
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

      <form
        action={deleteAction}
        className="space-y-2 rounded-xl border border-danger/40 bg-danger/10 p-4"
        onSubmit={(event) => {
          const confirmed = window.confirm(
            "Delete this member permanently? This removes membership history (assignments, shifts, and work-time entries) for this ranch.",
          );
          if (!confirmed) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="membershipId" value={membershipId} />
        <p className="text-sm font-semibold text-danger">Permanent delete</p>
        <p className="text-xs text-danger">
          Use this only when you want to fully remove this member from the ranch.
        </p>
        {deleteState.error ? (
          <p className="text-sm font-medium text-danger">{deleteState.error}</p>
        ) : null}
        <Button variant="danger" type="submit">
          Delete member permanently
        </Button>
      </form>
    </div>
  );
}
