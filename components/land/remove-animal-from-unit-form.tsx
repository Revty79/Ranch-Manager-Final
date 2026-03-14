"use client";

import { useActionState } from "react";
import { removeAnimalFromLandUnitAction, type LandActionState } from "@/lib/land/actions";

const initialState: LandActionState = {};

interface RemoveAnimalFromUnitFormProps {
  landUnitId: string;
  animalId: string;
}

export function RemoveAnimalFromUnitForm({
  landUnitId,
  animalId,
}: RemoveAnimalFromUnitFormProps) {
  const [state, formAction] = useActionState(removeAnimalFromLandUnitAction, initialState);

  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="landUnitId" value={landUnitId} />
      <input type="hidden" name="animalId" value={animalId} />
      <button
        type="submit"
        className="rounded-lg border px-2.5 py-1 text-xs font-semibold text-foreground-muted hover:bg-accent-soft hover:text-foreground"
      >
        Remove
      </button>
      {state.error ? <p className="text-[11px] text-danger">{state.error}</p> : null}
      {state.success ? <p className="text-[11px] text-accent">{state.success}</p> : null}
    </form>
  );
}
