"use client";

import { useActionState } from "react";
import {
  toggleProtocolTemplateActiveAction,
  type HerdRecordActionState,
} from "@/lib/herd/records-actions";

const initialState: HerdRecordActionState = {};

interface ToggleProtocolTemplateFormProps {
  templateId: string;
  isActive: boolean;
}

export function ToggleProtocolTemplateForm({
  templateId,
  isActive,
}: ToggleProtocolTemplateFormProps) {
  const [state, formAction] = useActionState(
    toggleProtocolTemplateActiveAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="templateId" value={templateId} />
      <input type="hidden" name="setActive" value={isActive ? "false" : "true"} />
      <button
        type="submit"
        className="rounded-lg border px-2.5 py-1 text-xs font-semibold text-foreground-muted hover:bg-accent-soft hover:text-foreground"
      >
        {isActive ? "Pause" : "Activate"}
      </button>
      {state.error ? <p className="text-[11px] text-danger">{state.error}</p> : null}
      {state.success ? <p className="text-[11px] text-accent">{state.success}</p> : null}
    </form>
  );
}
