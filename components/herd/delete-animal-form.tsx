"use client";

import { type FormEvent, useState } from "react";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Button } from "@/components/ui/button";
import { deleteAnimalAction } from "@/lib/herd/actions";

interface DeleteAnimalFormProps {
  animalId: string;
  tagId: string;
  displayName: string | null;
}

function normalizeTag(value: string): string {
  return value.trim().toLowerCase();
}

export function DeleteAnimalForm({
  animalId,
  tagId,
  displayName,
}: DeleteAnimalFormProps) {
  const [confirmTagInput, setConfirmTagInput] = useState("");
  const matchesTag = normalizeTag(confirmTagInput) === normalizeTag(tagId);
  const animalLabel = displayName ? `${tagId} - ${displayName}` : tagId;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!matchesTag) {
      event.preventDefault();
      return;
    }

    const accepted = window.confirm(
      `Delete ${animalLabel} permanently?\n\nThis removes the animal and related history records. This cannot be undone.`,
    );

    if (!accepted) {
      event.preventDefault();
    }
  }

  return (
    <form action={deleteAnimalAction} onSubmit={handleSubmit} className="space-y-3">
      <input type="hidden" name="animalId" value={animalId} />
      <FormFieldShell
        label={`Type ${tagId} to confirm delete`}
        hint="This confirmation helps prevent accidental permanent deletion."
      >
        <input
          name="confirmTagId"
          value={confirmTagInput}
          onChange={(event) => setConfirmTagInput(event.target.value)}
          placeholder={tagId}
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
          autoComplete="off"
          spellCheck={false}
          required
        />
      </FormFieldShell>

      <p className="text-xs text-foreground-muted">
        Permanent delete removes this animal record and linked event, location, and grazing history.
      </p>

      <Button type="submit" variant="danger" size="sm" disabled={!matchesTag}>
        Delete animal permanently
      </Button>
    </form>
  );
}
