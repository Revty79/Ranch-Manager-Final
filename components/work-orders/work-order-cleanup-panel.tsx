"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SubmitButton } from "@/components/auth/submit-button";
import {
  deleteDraftWorkOrderAction,
  type WorkOrderActionState,
  voidWorkOrderAction,
} from "@/lib/work-orders/actions";
import type { WorkOrderStatus } from "@/lib/db/schema";

const initialState: WorkOrderActionState = {};

export function WorkOrderCleanupPanel({
  workOrderId,
  workOrderTitle,
  workOrderStatus,
}: {
  workOrderId: string;
  workOrderTitle: string;
  workOrderStatus: WorkOrderStatus;
}) {
  const router = useRouter();
  const [deleteState, deleteAction] = useActionState(deleteDraftWorkOrderAction, initialState);
  const [voidState, voidAction] = useActionState(voidWorkOrderAction, initialState);

  useEffect(() => {
    if (deleteState.success) {
      router.push("/app/work-orders");
      return;
    }

    if (voidState.success) {
      router.refresh();
    }
  }, [deleteState.success, router, voidState.success]);

  if (workOrderStatus === "draft") {
    return (
      <form
        action={deleteAction}
        className="space-y-3 rounded-xl border border-danger/40 bg-danger/10 p-4"
        onSubmit={(event) => {
          const confirmed = window.confirm(
            `Delete draft "${workOrderTitle}" permanently? This cannot be undone.`,
          );
          if (!confirmed) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="workOrderId" value={workOrderId} />
        <p className="text-sm font-semibold text-danger">Delete draft work order</p>
        <p className="text-xs text-danger">
          Draft work orders are safe to remove permanently before dispatch.
        </p>
        {deleteState.error ? (
          <p className="text-xs font-medium text-danger">{deleteState.error}</p>
        ) : null}
        {deleteState.success ? (
          <p className="text-xs font-medium text-accent">{deleteState.success}</p>
        ) : null}
        <SubmitButton
          label="Delete draft permanently"
          pendingLabel="Deleting..."
          className="w-full md:w-fit"
        />
      </form>
    );
  }

  if (workOrderStatus === "completed") {
    return (
      <div className="rounded-xl border bg-surface p-4 text-sm text-foreground-muted">
        Completed work orders are retained as protected operational records. Use a follow-up work
        order to correct mistakes instead of deleting this record.
      </div>
    );
  }

  return (
    <form action={voidAction} className="space-y-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <p className="text-sm font-semibold text-warning">Void mistaken work order</p>
      <p className="text-xs text-warning">
        Voiding keeps the record, marks it cancelled, and saves an audit reason.
      </p>
      <label className="block space-y-1">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-warning">
          Reason
        </span>
        <textarea
          name="reason"
          placeholder="Example: Assigned to wrong crew and replaced with corrected work order #..."
          className="min-h-[90px] w-full rounded-xl border bg-surface px-3 py-2 text-sm"
          required
        />
      </label>
      {voidState.error ? <p className="text-xs font-medium text-danger">{voidState.error}</p> : null}
      {voidState.success ? <p className="text-xs font-medium text-accent">{voidState.success}</p> : null}
      <SubmitButton
        label="Void work order"
        pendingLabel="Voiding..."
        className="w-full md:w-fit"
      />
    </form>
  );
}
