"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Input } from "@/components/ui/input";
import {
  removeAnimalGroupFromLandUnitAction,
  type LandActionState,
} from "@/lib/land/actions";
import type { LandMovementGroupOption } from "@/lib/land/queries";

const initialState: LandActionState = {};

interface RemoveAnimalGroupFromUnitFormProps {
  landUnitId: string;
  groupOptions: LandMovementGroupOption[];
}

export function RemoveAnimalGroupFromUnitForm({
  landUnitId,
  groupOptions,
}: RemoveAnimalGroupFromUnitFormProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    removeAnimalGroupFromLandUnitAction,
    initialState,
  );

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [router, state.success]);

  if (!groupOptions.length) {
    return (
      <p className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
        No active herd/groups are available in this ranch yet.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="landUnitId" value={landUnitId} />

      <FormFieldShell
        label="Herd/group to remove"
        hint="Closes active assignment records for group members currently in this unit."
      >
        <select
          name="animalGroupId"
          required
          defaultValue=""
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
        >
          <option value="" disabled>
            Select herd/group...
          </option>
          {groupOptions.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name} ({group.memberCount} active)
            </option>
          ))}
        </select>
      </FormFieldShell>

      <FormFieldShell label="Notes (optional)">
        <Input
          name="notes"
          placeholder="Example: Pulled this herd out before pasture rest window."
        />
      </FormFieldShell>

      {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
      {state.success ? <p className="text-sm font-medium text-accent">{state.success}</p> : null}

      <SubmitButton
        label="Remove herd/group from this unit"
        pendingLabel="Removing herd/group..."
        className="w-full md:w-fit"
      />
    </form>
  );
}

