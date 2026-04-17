"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  setAnimalGroupMembersAction,
  toggleAnimalGroupActiveAction,
  type HerdGroupActionState,
} from "@/lib/herd/group-actions";
import {
  formatAnimalGroupType,
} from "@/lib/herd/constants";
import type { AnimalGroupWorkspaceGroup } from "@/lib/herd/group-queries";

const initialState: HerdGroupActionState = {};

interface ManageAnimalGroupMembersFormProps {
  group: AnimalGroupWorkspaceGroup;
  animalOptions: Array<{ id: string; label: string }>;
}

export function ManageAnimalGroupMembersForm({
  group,
  animalOptions,
}: ManageAnimalGroupMembersFormProps) {
  const [membershipState, membershipAction] = useActionState(
    setAnimalGroupMembersAction,
    initialState,
  );
  const [toggleState, toggleAction] = useActionState(
    toggleAnimalGroupActiveAction,
    initialState,
  );

  return (
    <article className="space-y-3 rounded-xl border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{group.name}</p>
          <p className="text-xs text-foreground-muted">
            {formatAnimalGroupType(group.groupType)} - {group.memberCount} active members
          </p>
          {group.description ? (
            <p className="text-xs text-foreground-muted">{group.description}</p>
          ) : null}
        </div>
        <Badge variant={group.isActive ? "success" : "neutral"}>
          {group.isActive ? "active" : "paused"}
        </Badge>
      </div>

      {group.memberPreviewLabels.length ? (
        <p className="text-xs text-foreground-muted">
          Current members: {group.memberPreviewLabels.join(", ")}
          {group.memberCount > group.memberPreviewLabels.length
            ? ` +${group.memberCount - group.memberPreviewLabels.length} more`
            : ""}
        </p>
      ) : (
        <p className="text-xs text-foreground-muted">No active animals linked yet.</p>
      )}

      <form action={membershipAction} className="space-y-2">
        <input type="hidden" name="animalGroupId" value={group.id} />
        <FormFieldShell
          label="Set active members"
          hint="Select all animals that should belong to this group right now."
        >
          <select
            name="animalIds"
            multiple
            size={8}
            defaultValue={group.memberAnimalIds}
            className="w-full rounded-xl border bg-surface-strong px-3 py-2 text-sm"
          >
            {animalOptions.map((animal) => (
              <option key={animal.id} value={animal.id}>
                {animal.label}
              </option>
            ))}
          </select>
        </FormFieldShell>
        {membershipState.error ? (
          <p className="text-sm font-medium text-danger">{membershipState.error}</p>
        ) : null}
        {membershipState.success ? (
          <p className="text-sm font-medium text-accent">{membershipState.success}</p>
        ) : null}
        <SubmitButton
          label="Save members"
          pendingLabel="Saving members..."
          className="w-full md:w-fit"
        />
      </form>

      <form action={toggleAction} className="flex flex-col gap-2 border-t pt-3">
        <input type="hidden" name="animalGroupId" value={group.id} />
        <input type="hidden" name="nextIsActive" value={group.isActive ? "false" : "true"} />
        {toggleState.error ? <p className="text-sm font-medium text-danger">{toggleState.error}</p> : null}
        {toggleState.success ? <p className="text-sm font-medium text-accent">{toggleState.success}</p> : null}
        <Button variant={group.isActive ? "secondary" : "primary"} size="sm" className="w-fit">
          {group.isActive ? "Pause group" : "Activate group"}
        </Button>
      </form>
    </article>
  );
}

