"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  cancelMaintenanceRecordAction,
  completeMaintenanceRecordAction,
  updateMaintenanceRecordAction,
  type EquipmentActionState,
} from "@/lib/equipment/actions";
import {
  maintenancePriorityOptions,
  maintenanceStatusOptions,
  maintenanceTypeOptions,
} from "@/lib/equipment/constants";
import type {
  EquipmentMaintenanceRow,
  LinkableWorkOrderOption,
} from "@/lib/equipment/queries";
import type { AssignableMember } from "@/lib/work-orders/queries";

const initialState: EquipmentActionState = {};

interface EditMaintenanceRecordFormProps {
  equipmentId: string;
  maintenance: EquipmentMaintenanceRow;
  members: AssignableMember[];
  workOrderOptions: LinkableWorkOrderOption[];
}

function formatWorkOrderOptionLabel(option: LinkableWorkOrderOption): string {
  const dueAt =
    option.dueAt instanceof Date
      ? option.dueAt
      : option.dueAt
        ? new Date(option.dueAt)
        : null;
  const dueLabel =
    dueAt && !Number.isNaN(dueAt.getTime())
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      }).format(dueAt)
    : "No due date";
  return `${option.title} (${option.status.replace("_", " ")}, ${dueLabel})`;
}

export function EditMaintenanceRecordForm({
  equipmentId,
  maintenance,
  members,
  workOrderOptions,
}: EditMaintenanceRecordFormProps) {
  const [updateState, updateAction] = useActionState(
    updateMaintenanceRecordAction,
    initialState,
  );
  const [completeState, completeAction] = useActionState(
    completeMaintenanceRecordAction,
    initialState,
  );
  const [cancelState, cancelAction] = useActionState(
    cancelMaintenanceRecordAction,
    initialState,
  );
  const activeMembers = members.filter((member) => member.isActive);
  const isCompleted = maintenance.status === "completed";
  const isCancelled = maintenance.status === "cancelled";

  return (
    <div className="space-y-3 rounded-xl border bg-surface px-4 py-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold">{maintenance.title}</p>
        <p className="text-xs text-foreground-muted">
          {maintenance.maintenanceType.replace("_", " ")} - {maintenance.status.replace("_", " ")} - {maintenance.priority}
        </p>
      </div>

      <form action={updateAction} className="grid gap-3 rounded-lg border bg-surface-strong px-3 py-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <p className="text-sm font-medium text-foreground">Edit maintenance details</p>
        </div>

        <input type="hidden" name="maintenanceId" value={maintenance.id} />
        <input type="hidden" name="equipmentId" value={equipmentId} />

        <FormFieldShell label="Title">
          <Input name="title" defaultValue={maintenance.title} required />
        </FormFieldShell>
        <FormFieldShell label="Type">
          <select
            name="maintenanceType"
            defaultValue={maintenance.maintenanceType}
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
            defaultValue={maintenance.status}
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
            defaultValue={maintenance.priority}
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
          <Input name="dueOn" type="date" defaultValue={maintenance.dueOn ?? ""} />
        </FormFieldShell>
        <FormFieldShell label="Completed date">
          <Input
            name="completedOn"
            type="date"
            defaultValue={maintenance.completedOn ?? ""}
          />
        </FormFieldShell>

        <FormFieldShell label="Assign to">
          <select
            name="assignedMembershipId"
            defaultValue={maintenance.assignedMembershipId ?? ""}
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
        <FormFieldShell label="Cost">
          <Input
            name="costDollars"
            type="number"
            min="0"
            step="0.01"
            defaultValue={
              maintenance.costCents == null
                ? ""
                : (maintenance.costCents / 100).toFixed(2)
            }
          />
        </FormFieldShell>

        <div className="md:col-span-2">
          <FormFieldShell label="Link existing work order">
            <select
              name="relatedWorkOrderId"
              defaultValue={maintenance.relatedWorkOrderId ?? ""}
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
            <span>Create related work order from these details</span>
          </label>
        </div>

        <div className="md:col-span-2">
          <FormFieldShell label="Notes">
            <Textarea name="notes" defaultValue={maintenance.notes ?? ""} />
          </FormFieldShell>
        </div>

        <div className="md:col-span-2 flex flex-col gap-2">
          {updateState.error ? (
            <p className="text-sm font-medium text-danger">{updateState.error}</p>
          ) : null}
          {updateState.success ? (
            <p className="text-sm font-medium text-accent">{updateState.success}</p>
          ) : null}
          <SubmitButton
            label="Save maintenance changes"
            pendingLabel="Saving changes..."
            className="w-full md:w-fit"
          />
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        {!isCompleted ? (
          <form action={completeAction}>
            <input type="hidden" name="maintenanceId" value={maintenance.id} />
            <SubmitButton
              label="Mark completed"
              pendingLabel="Marking completed..."
              className="w-full md:w-fit"
            />
          </form>
        ) : null}
        {!isCancelled ? (
          <form action={cancelAction}>
            <input type="hidden" name="maintenanceId" value={maintenance.id} />
            <SubmitButton
              label="Cancel maintenance"
              pendingLabel="Cancelling..."
              className="w-full md:w-fit"
            />
          </form>
        ) : null}
      </div>

      {completeState.error ? (
        <p className="text-sm font-medium text-danger">{completeState.error}</p>
      ) : null}
      {completeState.success ? (
        <p className="text-sm font-medium text-accent">{completeState.success}</p>
      ) : null}
      {cancelState.error ? (
        <p className="text-sm font-medium text-danger">{cancelState.error}</p>
      ) : null}
      {cancelState.success ? (
        <p className="text-sm font-medium text-accent">{cancelState.success}</p>
      ) : null}
    </div>
  );
}
