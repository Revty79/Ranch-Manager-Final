"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createWorkOrderAction, type WorkOrderActionState } from "@/lib/work-orders/actions";
import type { AssignableMember } from "@/lib/work-orders/queries";

const initialState: WorkOrderActionState = {};

export function CreateWorkOrderForm({
  members,
}: {
  members: AssignableMember[];
}) {
  const [state, formAction] = useActionState(createWorkOrderAction, initialState);
  const activeMembers = members.filter((member) => member.isActive);

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2">
      <FormFieldShell label="Title">
        <Input name="title" placeholder="North fence repair" required />
      </FormFieldShell>
      <FormFieldShell label="Due date (optional)">
        <Input name="dueAt" type="datetime-local" />
      </FormFieldShell>
      <FormFieldShell label="Status">
        <select
          name="status"
          defaultValue="open"
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="draft">Draft</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </FormFieldShell>
      <FormFieldShell label="Priority">
        <select
          name="priority"
          defaultValue="normal"
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
        </select>
      </FormFieldShell>
      <FormFieldShell label="Description" className="md:col-span-2">
        <Textarea name="description" placeholder="Scope, materials, and context..." />
      </FormFieldShell>
      <FormFieldShell
        label="Assign to"
        hint={activeMembers.length ? "Choose one or more active members." : "No active members yet."}
        className="md:col-span-2"
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {activeMembers.map((member) => (
            <label
              key={member.membershipId}
              className="flex items-center gap-2 rounded-xl border bg-surface px-3 py-2 text-sm"
            >
              <input type="checkbox" name="assigneeIds" value={member.membershipId} />
              <span>
                {member.fullName} ({member.role})
              </span>
            </label>
          ))}
        </div>
      </FormFieldShell>
      <div className="md:col-span-2 flex flex-col gap-2">
        {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
        {state.success ? (
          <p className="text-sm font-medium text-accent">{state.success}</p>
        ) : null}
        <SubmitButton
          label="Create work order"
          pendingLabel="Creating work order..."
          className="w-full md:w-fit"
        />
      </div>
    </form>
  );
}
