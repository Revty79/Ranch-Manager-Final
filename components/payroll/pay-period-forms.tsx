"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  addPayrollAdvanceAction,
  createPayrollPeriodAction,
  type PayrollPeriodActionState,
} from "@/lib/payroll/period-actions";
import type { PayrollPeriodRecord } from "@/lib/payroll/period-queries";
import { Button } from "@/components/ui/button";

const initialState: PayrollPeriodActionState = {};

interface PayPeriodFormsProps {
  canManage: boolean;
  selectedPeriod: PayrollPeriodRecord | null;
  memberOptions: { membershipId: string; fullName: string }[];
}

export function PayPeriodForms({
  canManage,
  selectedPeriod,
  memberOptions,
}: PayPeriodFormsProps) {
  const router = useRouter();
  const [createState, createAction] = useActionState(
    createPayrollPeriodAction,
    initialState,
  );
  const [advanceState, advanceAction] = useActionState(
    addPayrollAdvanceAction,
    initialState,
  );
  const canSubmitAdvance = canManage && !!selectedPeriod && memberOptions.length > 0;

  useEffect(() => {
    if (createState.success || advanceState.success) {
      router.refresh();
    }
  }, [advanceState.success, createState.success, router]);

  return (
    <div className="space-y-4">
      <form action={createAction} className="grid gap-3 md:grid-cols-4">
        <label className="space-y-1 text-sm">
          <span className="text-foreground-muted">Period start</span>
          <input
            name="periodStart"
            type="date"
            className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
            disabled={!canManage}
            required
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-foreground-muted">Period end</span>
          <input
            name="periodEnd"
            type="date"
            className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
            disabled={!canManage}
            required
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-foreground-muted">Pay date</span>
          <input
            name="payDate"
            type="date"
            className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
            disabled={!canManage}
            required
          />
        </label>
        <div className="flex items-end">
          {canManage ? (
            <Button type="submit" className="h-10 w-full md:w-fit">
              Create pay period
            </Button>
          ) : (
            <p className="text-sm text-foreground-muted">Owner controls only.</p>
          )}
        </div>
        {createState.error ? (
          <p className="md:col-span-4 text-sm font-medium text-danger">{createState.error}</p>
        ) : null}
        {createState.success ? (
          <p className="md:col-span-4 text-sm font-medium text-accent">{createState.success}</p>
        ) : null}
      </form>

      <form action={advanceAction} className="grid gap-3 md:grid-cols-4">
        {selectedPeriod ? <input type="hidden" name="periodId" value={selectedPeriod.id} /> : null}
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="text-foreground-muted">Add advance for selected period</span>
          <select
            name="membershipId"
            className="h-10 w-full rounded-xl border bg-surface px-3 text-sm text-foreground"
            disabled={!canSubmitAdvance}
            required
          >
            {memberOptions.length ? (
              memberOptions.map((member) => (
                <option key={member.membershipId} value={member.membershipId}>
                  {member.fullName}
                </option>
              ))
            ) : (
              <option value="">No active members</option>
            )}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-foreground-muted">Amount</span>
          <input
            name="amount"
            type="number"
            min={0.01}
            step="0.01"
            placeholder="0.00"
            className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
            disabled={!canSubmitAdvance}
            required
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-foreground-muted">Note (optional)</span>
          <input
            name="note"
            type="text"
            maxLength={200}
            placeholder="Fuel, emergency, supplies..."
            className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
            disabled={!canSubmitAdvance}
          />
        </label>
        {advanceState.error ? (
          <p className="md:col-span-4 text-sm font-medium text-danger">{advanceState.error}</p>
        ) : null}
        {advanceState.success ? (
          <p className="md:col-span-4 text-sm font-medium text-accent">{advanceState.success}</p>
        ) : null}
        {canManage && canSubmitAdvance ? (
          <Button type="submit" variant="secondary" className="md:col-span-4 w-full md:w-fit">
            Add period advance
          </Button>
        ) : canManage && !selectedPeriod ? (
          <p className="md:col-span-4 text-sm text-foreground-muted">
            Create and select a pay period to add advances.
          </p>
        ) : canManage ? (
          <p className="md:col-span-4 text-sm text-foreground-muted">
            Add an active team member to assign period advances.
          </p>
        ) : null}
      </form>
    </div>
  );
}
