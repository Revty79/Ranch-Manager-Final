"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createMaintenanceRecordAction,
  type EquipmentActionState,
} from "@/lib/equipment/actions";
import {
  maintenancePriorityOptions,
  maintenanceStatusOptions,
  maintenanceTypeOptions,
} from "@/lib/equipment/constants";
import type { LinkableWorkOrderOption } from "@/lib/equipment/queries";
import type { AssignableMember } from "@/lib/work-orders/queries";

const initialState: EquipmentActionState = {};

interface CreateMaintenanceRecordFormProps {
  equipmentId: string;
  members: AssignableMember[];
  workOrderOptions: LinkableWorkOrderOption[];
}

function formatWorkOrderOptionLabel(option: LinkableWorkOrderOption): string {
  const dueLabel = option.dueAt
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      }).format(option.dueAt)
    : "No due date";
  return `${option.title} (${option.status.replace("_", " ")}, ${dueLabel})`;
}

export function CreateMaintenanceRecordForm({
  equipmentId,
  members,
  workOrderOptions,
}: CreateMaintenanceRecordFormProps) {
  const [state, formAction] = useActionState(
    createMaintenanceRecordAction,
    initialState,
  );
  const activeMembers = members.filter((member) => member.isActive);

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2">
      <input type="hidden" name="equipmentId" value={equipmentId} />

      <FormFieldShell label="Maintenance title">
        <Input name="title" placeholder="Oil change - 5k interval" required />
      </FormFieldShell>
      <FormFieldShell label="Type">
        <select
          name="maintenanceType"
          defaultValue="routine"
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          {maintenanceTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormFieldShell>

      <FormFieldShell label="Status">
        <select
          name="status"
          defaultValue="scheduled"
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          {maintenanceStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormFieldShell>
      <FormFieldShell label="Priority">
        <select
          name="priority"
          defaultValue="normal"
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          {maintenancePriorityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormFieldShell>

      <FormFieldShell label="Due date">
        <Input name="dueOn" type="date" />
      </FormFieldShell>
      <FormFieldShell label="Completed date">
        <Input name="completedOn" type="date" />
      </FormFieldShell>

      <FormFieldShell label="Assign to">
        <select
          name="assignedMembershipId"
          defaultValue=""
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          <option value="">Unassigned</option>
          {activeMembers.map((member) => (
            <option key={member.membershipId} value={member.membershipId}>
              {member.fullName} ({member.role})
            </option>
          ))}
        </select>
      </FormFieldShell>
      <FormFieldShell label="Cost (optional)">
        <Input name="costDollars" type="number" min="0" step="0.01" placeholder="0.00" />
      </FormFieldShell>

      <div className="md:col-span-2">
        <FormFieldShell
          label="Link existing work order (optional)"
          hint="Optional: choose an existing open work order or check Create related work order below."
        >
          <select
            name="relatedWorkOrderId"
            defaultValue=""
            className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
          >
            <option value="">No linked work order</option>
            {workOrderOptions.map((workOrder) => (
              <option key={workOrder.id} value={workOrder.id}>
                {formatWorkOrderOptionLabel(workOrder)}
              </option>
            ))}
          </select>
        </FormFieldShell>
      </div>

      <div className="md:col-span-2">
        <label className="flex items-center gap-2 rounded-xl border bg-surface px-3 py-2 text-sm">
          <input type="checkbox" name="createWorkOrder" />
          <span>Create related work order from this maintenance record</span>
        </label>
      </div>

      <div className="md:col-span-2">
        <FormFieldShell label="Notes">
          <Textarea
            name="notes"
            placeholder="Scope, parts needed, safety notes, or context."
          />
        </FormFieldShell>
      </div>

      <div className="md:col-span-2 flex flex-col gap-2">
        {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
        {state.success ? (
          <p className="text-sm font-medium text-accent">{state.success}</p>
        ) : null}
        <SubmitButton
          label="Add maintenance record"
          pendingLabel="Saving maintenance..."
          className="w-full md:w-fit"
        />
      </div>
    </form>
  );
}

