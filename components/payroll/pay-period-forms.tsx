"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  addPayrollAdvanceAction,
  updatePayrollSettingsAction,
  type PayrollPeriodActionState,
} from "@/lib/payroll/period-actions";
import type {
  PayrollPeriodRecord,
  PayrollSettingsRecord,
} from "@/lib/payroll/period-queries";
import { Button } from "@/components/ui/button";

const initialState: PayrollPeriodActionState = {};

interface PayPeriodFormsProps {
  canManage: boolean;
  settings: PayrollSettingsRecord;
  selectedPeriod: PayrollPeriodRecord;
  memberOptions: { membershipId: string; fullName: string }[];
}

export function PayPeriodForms({
  canManage,
  settings,
  selectedPeriod,
  memberOptions,
}: PayPeriodFormsProps) {
  const router = useRouter();
  const [settingsState, settingsAction] = useActionState(
    updatePayrollSettingsAction,
    initialState,
  );
  const [advanceState, advanceAction] = useActionState(
    addPayrollAdvanceAction,
    initialState,
  );

  useEffect(() => {
    if (settingsState.success || advanceState.success) {
      router.refresh();
    }
  }, [advanceState.success, router, settingsState.success]);

  return (
    <div className="space-y-4">
      <form action={settingsAction} className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="text-foreground-muted">Anchor start date</span>
          <input
            name="anchorStartDate"
            type="date"
            defaultValue={settings.anchorStartDate}
            className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
            disabled={!canManage}
            required
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-foreground-muted">Period length (days)</span>
          <input
            name="periodLengthDays"
            type="number"
            min={7}
            max={31}
            defaultValue={settings.periodLengthDays}
            className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
            disabled={!canManage}
            required
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-foreground-muted">Payday offset after period end</span>
          <input
            name="paydayOffsetDays"
            type="number"
            min={0}
            max={31}
            defaultValue={settings.paydayOffsetDays}
            className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
            disabled={!canManage}
            required
          />
        </label>
        {settingsState.error ? (
          <p className="md:col-span-3 text-sm font-medium text-danger">{settingsState.error}</p>
        ) : null}
        {settingsState.success ? (
          <p className="md:col-span-3 text-sm font-medium text-accent">{settingsState.success}</p>
        ) : null}
        {canManage ? (
          <Button type="submit" className="md:col-span-3 w-full md:w-fit">
            Save payroll schedule
          </Button>
        ) : (
          <p className="md:col-span-3 text-sm text-foreground-muted">
            Owners can update payroll schedule settings.
          </p>
        )}
      </form>

      <form action={advanceAction} className="grid gap-3 md:grid-cols-4">
        <input type="hidden" name="periodId" value={selectedPeriod.id} />
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="text-foreground-muted">Add advance for selected period</span>
          <select
            name="membershipId"
            className="h-10 w-full rounded-xl border bg-surface px-3 text-sm text-foreground"
            disabled={!canManage || memberOptions.length === 0}
            required
          >
            {memberOptions.map((member) => (
              <option key={member.membershipId} value={member.membershipId}>
                {member.fullName}
              </option>
            ))}
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
            disabled={!canManage}
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
            disabled={!canManage}
          />
        </label>
        {advanceState.error ? (
          <p className="md:col-span-4 text-sm font-medium text-danger">{advanceState.error}</p>
        ) : null}
        {advanceState.success ? (
          <p className="md:col-span-4 text-sm font-medium text-accent">{advanceState.success}</p>
        ) : null}
        {canManage && memberOptions.length > 0 ? (
          <Button type="submit" variant="secondary" className="md:col-span-4 w-full md:w-fit">
            Add period advance
          </Button>
        ) : canManage ? (
          <p className="md:col-span-4 text-sm text-foreground-muted">
            Add an active team member to assign period advances.
          </p>
        ) : null}
      </form>
    </div>
  );
}
