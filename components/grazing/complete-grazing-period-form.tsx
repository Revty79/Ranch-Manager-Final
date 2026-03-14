"use client";

import { useActionState } from "react";
import {
  completeGrazingPeriodAction,
  type GrazingActionState,
} from "@/lib/grazing/actions";

const initialState: GrazingActionState = {};

interface CompleteGrazingPeriodFormProps {
  grazingPeriodId: string;
  defaultEndedOn: string;
}

export function CompleteGrazingPeriodForm({
  grazingPeriodId,
  defaultEndedOn,
}: CompleteGrazingPeriodFormProps) {
  const [state, formAction] = useActionState(completeGrazingPeriodAction, initialState);

  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="grazingPeriodId" value={grazingPeriodId} />
      <input type="hidden" name="endedOn" value={defaultEndedOn} />
      <button
        type="submit"
        className="rounded-lg border px-2.5 py-1 text-xs font-semibold text-foreground-muted hover:bg-accent-soft hover:text-foreground"
      >
        Mark completed
      </button>
      {state.error ? <p className="text-[11px] text-danger">{state.error}</p> : null}
      {state.success ? <p className="text-[11px] text-accent">{state.success}</p> : null}
    </form>
  );
}
