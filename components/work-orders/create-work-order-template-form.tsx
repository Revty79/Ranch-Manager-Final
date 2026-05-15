"use client";

import { useState } from "react";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { WorkOrderCompensationType, WorkOrderIncentiveTimerType } from "@/lib/db/schema";
import { createWorkOrderTemplateFormAction } from "@/lib/work-orders/actions";
import type { AssignableMember } from "@/lib/work-orders/queries";

export function CreateWorkOrderTemplateForm({
  members,
}: {
  members: AssignableMember[];
}) {
  const [compensationType, setCompensationType] =
    useState<WorkOrderCompensationType>("standard");
  const [incentiveTimerType, setIncentiveTimerType] =
    useState<WorkOrderIncentiveTimerType>("none");
  const activeMembers = members.filter((member) => member.isActive);

  return (
    <form action={createWorkOrderTemplateFormAction} className="grid gap-3 md:grid-cols-2">
      <FormFieldShell label="Template name">
        <Input name="templateName" placeholder="Morning feed run" required />
      </FormFieldShell>
      <FormFieldShell label="Work order title">
        <Input name="title" placeholder="Morning feed check" required />
      </FormFieldShell>
      <FormFieldShell label="Description" className="md:col-span-2">
        <Textarea
          name="description"
          placeholder="Reusable scope, tools, and completion expectations..."
        />
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
      <FormFieldShell label="Compensation type">
        <select
          name="compensationType"
          value={compensationType}
          onChange={(event) =>
            setCompensationType(event.target.value as WorkOrderCompensationType)
          }
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="standard">Regular work order</option>
          <option value="flat_amount">Flat amount</option>
        </select>
      </FormFieldShell>
      {compensationType === "flat_amount" ? (
        <FormFieldShell label="Flat amount">
          <Input name="flatPay" type="number" step="0.01" min="0.01" defaultValue="0.00" required />
        </FormFieldShell>
      ) : (
        <input type="hidden" name="flatPay" value="0" />
      )}
      <FormFieldShell label="Incentive pay (optional)">
        <Input name="incentivePay" type="number" step="0.01" min="0" defaultValue="0" />
      </FormFieldShell>
      <FormFieldShell label="Incentive timer">
        <select
          name="incentiveTimerType"
          value={incentiveTimerType}
          onChange={(event) =>
            setIncentiveTimerType(event.target.value as WorkOrderIncentiveTimerType)
          }
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="none">No timer</option>
          <option value="hours">Set by hours</option>
        </select>
      </FormFieldShell>
      {incentiveTimerType === "hours" ? (
        <FormFieldShell label="Incentive countdown hours" className="md:col-span-2">
          <Input name="incentiveHours" type="number" min="1" step="1" defaultValue="24" required />
        </FormFieldShell>
      ) : null}
      <div className="space-y-2 md:col-span-2">
        <p className="text-sm font-semibold text-foreground">Default assignees</p>
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
        <p className="text-xs text-foreground-muted">
          {activeMembers.length ? "Optional: pre-assign when generated." : "No active members yet."}
        </p>
      </div>
      <div className="md:col-span-2 flex flex-col gap-2">
        <button
          type="submit"
          className="h-10 w-full rounded-xl bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover md:w-fit"
        >
          Save template
        </button>
      </div>
    </form>
  );
}
