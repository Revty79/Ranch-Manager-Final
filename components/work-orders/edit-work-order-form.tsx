"use client";

import { useState } from "react";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTimeInputForTimeZone } from "@/lib/date-time-local";
import type {
  WorkOrderCompensationType,
  WorkOrderIncentiveTimerType,
} from "@/lib/db/schema";
import { updateWorkOrderFormAction } from "@/lib/work-orders/actions";
import type { AssignableMember, WorkOrderDetail } from "@/lib/work-orders/queries";

function toDateTimeLocal(value: Date | null, timeZone: string): string {
  if (!value) {
    return "";
  }

  return formatDateTimeInputForTimeZone(value, timeZone);
}

export function EditWorkOrderForm({
  workOrder,
  members,
  timeZone,
}: {
  workOrder: WorkOrderDetail;
  members: AssignableMember[];
  timeZone: string;
}) {
  const [compensationType, setCompensationType] = useState<WorkOrderCompensationType>(
    workOrder.compensationType,
  );
  const [incentiveTimerType, setIncentiveTimerType] = useState<WorkOrderIncentiveTimerType>(
    workOrder.incentiveTimerType,
  );
  const activeMembers = members.filter((member) => member.isActive);

  return (
    <form action={updateWorkOrderFormAction} className="grid gap-3 md:grid-cols-2">
      <input type="hidden" name="workOrderId" value={workOrder.id} />
      <FormFieldShell label="Title">
        <Input name="title" defaultValue={workOrder.title} required />
      </FormFieldShell>
      <FormFieldShell label="Due date (optional)">
        <Input
          name="dueAt"
          type="datetime-local"
          defaultValue={toDateTimeLocal(workOrder.dueAt, timeZone)}
        />
      </FormFieldShell>
      <FormFieldShell label="Status">
        <select
          name="status"
          defaultValue={workOrder.status}
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="draft">Draft</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
        </select>
      </FormFieldShell>
      <FormFieldShell label="Priority">
        <select
          name="priority"
          defaultValue={workOrder.priority}
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
        </select>
      </FormFieldShell>
      <FormFieldShell label="Description" className="md:col-span-2">
        <Textarea name="description" defaultValue={workOrder.description ?? ""} />
      </FormFieldShell>
      <FormFieldShell
        label="Work-order pay"
        hint="Choose regular tracked work or a one-time flat amount paid when the order is completed."
      >
        <select
          name="compensationType"
          value={compensationType}
          onChange={(event) =>
            setCompensationType(event.target.value as WorkOrderCompensationType)
          }
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="standard">Regular work order</option>
          <option value="flat_amount">Flat amount only</option>
        </select>
      </FormFieldShell>
      {compensationType === "flat_amount" ? (
        <FormFieldShell
          label="Flat amount"
          hint="Pays once when completed. If multiple people are assigned, payroll splits the amount across eligible assignees."
        >
          <Input
            name="flatPay"
            type="number"
            step="0.01"
            min="0.01"
            defaultValue={(workOrder.flatPayCents / 100).toFixed(2)}
            required
          />
        </FormFieldShell>
      ) : (
        <input type="hidden" name="flatPay" value="0" />
      )}
      <FormFieldShell
        label="Incentive pay (optional)"
        hint="If set above $0, choose an incentive timer to make it earnable."
      >
        <Input
          name="incentivePay"
          type="number"
          step="0.01"
          min="0"
          defaultValue={(workOrder.incentivePayCents / 100).toFixed(2)}
        />
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
          <option value="deadline">Set by specific date</option>
        </select>
      </FormFieldShell>
      {incentiveTimerType === "hours" ? (
        <FormFieldShell
          label="Incentive countdown hours"
          className="md:col-span-2"
          hint="Saving resets the countdown from now."
        >
          <Input
            name="incentiveHours"
            type="number"
            min="1"
            step="1"
            defaultValue={workOrder.incentiveDurationHours ?? 24}
            required
          />
        </FormFieldShell>
      ) : null}
      {incentiveTimerType === "deadline" ? (
        <FormFieldShell
          label="Incentive deadline"
          className="md:col-span-2"
          hint="Incentive is available until this date and time."
        >
          <Input
            name="incentiveDeadlineAt"
            type="datetime-local"
            defaultValue={toDateTimeLocal(workOrder.incentiveEndsAt, timeZone)}
            required
          />
        </FormFieldShell>
      ) : null}
      <div className="space-y-2 md:col-span-2">
        <p className="text-sm font-semibold text-foreground">Assign to</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {activeMembers.map((member) => (
            <label
              key={member.membershipId}
              className="flex items-center gap-2 rounded-xl border bg-surface px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                name="assigneeIds"
                value={member.membershipId}
                defaultChecked={workOrder.assignedMembershipIds.includes(member.membershipId)}
              />
              <span>
                {member.fullName} ({member.role})
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-foreground-muted">
          {activeMembers.length ? "Choose active assignees." : "No active members yet."}
        </p>
      </div>
      <div className="md:col-span-2 flex flex-col gap-2">
        <button
          type="submit"
          className="h-10 w-full rounded-xl bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover md:w-fit"
        >
          Save work order
        </button>
      </div>
    </form>
  );
}
