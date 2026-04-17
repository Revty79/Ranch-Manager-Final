"use client";

import { useActionState, useMemo, useState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormFieldShell } from "@/components/patterns/form-field-shell";
import { Input } from "@/components/ui/input";
import {
  assignAnimalToLandUnitAction,
  removeAnimalFromLandUnitAction,
  type LandActionState,
} from "@/lib/land/actions";
import { movementReasonOptions } from "@/lib/land/constants";

const initialState: LandActionState = {};

interface GrazingUnitOccupancyFormProps {
  landUnits: Array<{ id: string; name: string; unitType: string }>;
  animals: Array<{ id: string; label: string }>;
  occupancyAssignments: Array<{
    landUnitId: string;
    animalId: string;
    label: string;
  }>;
}

function assignmentKey(landUnitId: string, animalId: string): string {
  return `${landUnitId}|${animalId}`;
}

function parseAssignmentKey(value: string): { landUnitId: string; animalId: string } | null {
  const [landUnitId, animalId, extra] = value.split("|");
  if (!landUnitId || !animalId || extra) return null;
  return { landUnitId, animalId };
}

export function GrazingUnitOccupancyForm({
  landUnits,
  animals,
  occupancyAssignments,
}: GrazingUnitOccupancyFormProps) {
  const [assignState, assignFormAction] = useActionState(
    assignAnimalToLandUnitAction,
    initialState,
  );
  const [removeState, removeFormAction] = useActionState(
    removeAnimalFromLandUnitAction,
    initialState,
  );

  const defaultSelection = occupancyAssignments[0]
    ? assignmentKey(
        occupancyAssignments[0].landUnitId,
        occupancyAssignments[0].animalId,
      )
    : "";
  const [selectedAssignment, setSelectedAssignment] = useState(defaultSelection);
  const selectedAssignmentExists = occupancyAssignments.some(
    (assignment) => assignmentKey(assignment.landUnitId, assignment.animalId) === selectedAssignment,
  );
  const effectiveSelection = selectedAssignmentExists ? selectedAssignment : defaultSelection;
  const parsedSelection = useMemo(
    () => parseAssignmentKey(effectiveSelection),
    [effectiveSelection],
  );

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <form action={assignFormAction} className="space-y-3 rounded-xl border bg-surface px-4 py-4">
        <p className="text-sm font-semibold">Move onto a grazing unit</p>

        <FormFieldShell label="Grazing unit">
          <select
            name="landUnitId"
            required
            defaultValue=""
            className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
          >
            <option value="" disabled>
              Select unit...
            </option>
            {landUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name} ({unit.unitType.replace("_", " ")})
              </option>
            ))}
          </select>
        </FormFieldShell>

        {animals.length ? (
          <FormFieldShell label="Animal">
            <select
              name="animalId"
              required
              defaultValue=""
              className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
            >
              <option value="" disabled>
                Select animal...
              </option>
              {animals.map((animal) => (
                <option key={animal.id} value={animal.id}>
                  {animal.label}
                </option>
              ))}
            </select>
          </FormFieldShell>
        ) : (
          <p className="rounded-lg border bg-surface-strong px-3 py-2 text-sm text-foreground-muted">
            No active animals available to move.
          </p>
        )}

        <FormFieldShell label="Movement reason">
          <select
            name="movementReason"
            defaultValue="grazing_rotation"
            className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
          >
            {movementReasonOptions.map((reason) => (
              <option key={reason.value} value={reason.value}>
                {reason.label}
              </option>
            ))}
          </select>
        </FormFieldShell>

        <FormFieldShell label="Notes (optional)">
          <Input name="notes" placeholder="Example: Move to fresh paddock for rotation day 1." />
        </FormFieldShell>

        {assignState.error ? <p className="text-sm font-medium text-danger">{assignState.error}</p> : null}
        {assignState.success ? (
          <p className="text-sm font-medium text-accent">{assignState.success}</p>
        ) : null}

        {animals.length ? (
          <SubmitButton
            label="Move onto grazing unit"
            pendingLabel="Recording movement..."
            className="w-full md:w-fit"
          />
        ) : null}
      </form>

      <form action={removeFormAction} className="space-y-3 rounded-xl border bg-surface px-4 py-4">
        <p className="text-sm font-semibold">Move off a grazing unit</p>

        {occupancyAssignments.length ? (
          <>
            <input
              type="hidden"
              name="landUnitId"
              value={parsedSelection?.landUnitId ?? ""}
            />
            <input type="hidden" name="animalId" value={parsedSelection?.animalId ?? ""} />

            <FormFieldShell label="Current occupancy">
              <select
                value={effectiveSelection}
                onChange={(event) => setSelectedAssignment(event.target.value)}
                className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
              >
                {occupancyAssignments.map((assignment) => (
                  <option
                    key={assignmentKey(assignment.landUnitId, assignment.animalId)}
                    value={assignmentKey(assignment.landUnitId, assignment.animalId)}
                  >
                    {assignment.label}
                  </option>
                ))}
              </select>
            </FormFieldShell>

            <FormFieldShell label="Notes (optional)">
              <Input name="notes" placeholder="Example: Pulled out for treatment and sorting." />
            </FormFieldShell>

            {removeState.error ? (
              <p className="text-sm font-medium text-danger">{removeState.error}</p>
            ) : null}
            {removeState.success ? (
              <p className="text-sm font-medium text-accent">{removeState.success}</p>
            ) : null}

            <SubmitButton
              label="Move off unit"
              pendingLabel="Recording removal..."
              className="w-full md:w-fit"
            />
          </>
        ) : (
          <p className="rounded-lg border bg-surface-strong px-3 py-2 text-sm text-foreground-muted">
            No active grazing occupancy records yet.
          </p>
        )}
      </form>
    </div>
  );
}
