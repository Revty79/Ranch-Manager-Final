"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createShiftEntryAction,
  deleteShiftEntryAction,
  deleteWorkEntryAction,
  updateShiftEntryAction,
  updateWorkEntryAction,
} from "@/lib/time/admin-actions";
import {
  formatDateTimeInputForTimeZone,
  parseDateTimeInputInTimeZone,
} from "@/lib/date-time-local";
import { Button } from "@/components/ui/button";

interface ShiftAdjustmentRow {
  id: string;
  startedAtIso: string;
  endedAtIso: string | null;
}

interface WorkAdjustmentRow {
  id: string;
  workOrderTitle: string;
  startedAtIso: string;
  endedAtIso: string | null;
}

interface TimeEntryAdjustmentsProps {
  membershipId: string;
  shiftRows: ShiftAdjustmentRow[];
  workRows: WorkAdjustmentRow[];
  timeZone: string;
}

interface EditState {
  error?: string;
  success?: string;
}

const initialState: EditState = {};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

const HOURS_24 = Array.from({ length: 24 }, (_, hour) => pad(hour));
const MINUTES_60 = Array.from({ length: 60 }, (_, minute) => pad(minute));

interface DateTimeParts {
  date: string;
  hour: string;
  minute: string;
}

function toDateTimeParts(value: string): DateTimeParts {
  const trimmed = value.trim();
  if (!trimmed) {
    return {
      date: "",
      hour: "00",
      minute: "00",
    };
  }

  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::\d{2})?$/);
  if (match) {
    return {
      date: match[1],
      hour: match[2],
      minute: match[3],
    };
  }

  return {
    date: "",
    hour: "00",
    minute: "00",
  };
}

function toDateTimeLocalInputFromParts(parts: DateTimeParts): string {
  if (!parts.date) {
    return "";
  }

  return `${parts.date}T${parts.hour}:${parts.minute}`;
}

function toDateTimeInputValue(isoValue: string | null, timeZone: string): string {
  if (!isoValue) {
    return "";
  }

  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return formatDateTimeInputForTimeZone(date, timeZone);
}

function nowDateTimeInputValue(timeZone: string): string {
  return formatDateTimeInputForTimeZone(new Date(), timeZone);
}

function addMinutesToInputValue(
  inputValue: string,
  minutesToAdd: number,
  timeZone: string,
): string {
  const base = parseDateTimeInputInTimeZone(inputValue, timeZone) ?? new Date();
  const shifted = new Date(base.getTime() + minutesToAdd * 60_000);
  return formatDateTimeInputForTimeZone(shifted, timeZone);
}

function todayAtHourInputValue(hour24: number, timeZone: string): string {
  const date = formatDateTimeInputForTimeZone(new Date(), timeZone).slice(0, 10);
  return `${date}T${pad(hour24)}:00`;
}

function formatDateTime(isoValue: string, timeZone: string): string {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(date);
}

function formatDuration(startedAtIso: string, endedAtIso: string | null): string {
  const startedAt = new Date(startedAtIso);
  const endedAt = endedAtIso ? new Date(endedAtIso) : new Date();
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
    return "Invalid duration";
  }

  const diffMs = Math.max(endedAt.getTime() - startedAt.getTime(), 0);
  const totalMinutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

interface DateTime24FieldProps {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

function DateTime24Field({
  name,
  label,
  value,
  onChange,
  required = false,
}: DateTime24FieldProps) {
  const parts = useMemo(() => toDateTimeParts(value), [value]);
  const hasDate = Boolean(parts.date);

  const update = (next: Partial<DateTimeParts>) => {
    const merged: DateTimeParts = {
      ...parts,
      ...next,
    };
    onChange(toDateTimeLocalInputFromParts(merged));
  };

  return (
    <label className="space-y-1 text-xs">
      <span className="text-foreground-muted">{label}</span>
      <input type="hidden" name={name} value={value} />
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_5.5rem]">
        <input
          type="date"
          value={parts.date}
          onChange={(event) => update({ date: event.target.value })}
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
          required={required}
        />
        <select
          value={parts.hour}
          onChange={(event) => update({ hour: event.target.value })}
          className="h-10 w-full rounded-xl border bg-surface px-2 text-sm"
          disabled={!hasDate}
          aria-label={`${label} hour (24-hour)`}
        >
          {HOURS_24.map((hour) => (
            <option key={`${name}-hour-${hour}`} value={hour}>
              {hour}
            </option>
          ))}
        </select>
        <select
          value={parts.minute}
          onChange={(event) => update({ minute: event.target.value })}
          className="h-10 w-full rounded-xl border bg-surface px-2 text-sm"
          disabled={!hasDate}
          aria-label={`${label} minute`}
        >
          {MINUTES_60.map((minute) => (
            <option key={`${name}-minute-${minute}`} value={minute}>
              {minute}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

function ShiftRowForm({ row, timeZone }: { row: ShiftAdjustmentRow; timeZone: string }) {
  const router = useRouter();
  const [startedAtValue, setStartedAtValue] = useState(() =>
    toDateTimeInputValue(row.startedAtIso, timeZone),
  );
  const [endedAtValue, setEndedAtValue] = useState(() =>
    toDateTimeInputValue(row.endedAtIso, timeZone),
  );
  const [state, formAction] = useActionState(updateShiftEntryAction, initialState);
  const [deleteState, deleteFormAction] = useActionState(
    deleteShiftEntryAction,
    initialState,
  );
  const duration = useMemo(
    () => formatDuration(row.startedAtIso, row.endedAtIso),
    [row.endedAtIso, row.startedAtIso],
  );

  useEffect(() => {
    if (state.success || deleteState.success) {
      router.refresh();
    }
  }, [deleteState.success, router, state.success]);

  return (
    <div className="space-y-2 rounded-xl border bg-surface p-3">
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="entryId" value={row.id} />
        <div className="text-xs text-foreground-muted">
          <span>{formatDateTime(row.startedAtIso, timeZone)}</span>
          <span> to </span>
          <span>{row.endedAtIso ? formatDateTime(row.endedAtIso, timeZone) : "Active"}</span>
          <span> ({duration})</span>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <DateTime24Field
            name="startedAt"
            label="Clock in"
            value={startedAtValue}
            onChange={setStartedAtValue}
            required
          />
          <DateTime24Field
            name="endedAt"
            label="Clock out (blank = active)"
            value={endedAtValue}
            onChange={setEndedAtValue}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border px-2 py-1 text-xs text-foreground-muted hover:bg-accent-soft"
            onClick={() => setStartedAtValue(nowDateTimeInputValue(timeZone))}
          >
            Clock in now
          </button>
          <button
            type="button"
            className="rounded-lg border px-2 py-1 text-xs text-foreground-muted hover:bg-accent-soft"
            onClick={() => setEndedAtValue(nowDateTimeInputValue(timeZone))}
          >
            Clock out now
          </button>
          <button
            type="button"
            className="rounded-lg border px-2 py-1 text-xs text-foreground-muted hover:bg-accent-soft"
            onClick={() =>
              setEndedAtValue(addMinutesToInputValue(startedAtValue, 30, timeZone))
            }
          >
            +30m from in
          </button>
          <button
            type="button"
            className="rounded-lg border px-2 py-1 text-xs text-foreground-muted hover:bg-accent-soft"
            onClick={() =>
              setEndedAtValue(addMinutesToInputValue(startedAtValue, 60, timeZone))
            }
          >
            +1h from in
          </button>
          <button
            type="button"
            className="rounded-lg border px-2 py-1 text-xs text-foreground-muted hover:bg-accent-soft"
            onClick={() => setEndedAtValue("")}
          >
            Clear out
          </button>
        </div>
        {state.error ? <p className="text-xs font-medium text-danger">{state.error}</p> : null}
        {state.success ? <p className="text-xs font-medium text-accent">{state.success}</p> : null}
        <Button size="sm" variant="secondary" type="submit">
          Save shift entry
        </Button>
      </form>

      <form
        action={deleteFormAction}
        className="border-t border-border/60 pt-2"
        onSubmit={(event) => {
          const confirmed = window.confirm(
            "Delete this shift entry permanently? This updates payroll totals and cannot be undone.",
          );
          if (!confirmed) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="entryId" value={row.id} />
        {deleteState.error ? (
          <p className="mb-2 text-xs font-medium text-danger">{deleteState.error}</p>
        ) : null}
        {deleteState.success ? (
          <p className="mb-2 text-xs font-medium text-accent">{deleteState.success}</p>
        ) : null}
        <Button size="sm" variant="danger" type="submit">
          Delete shift entry
        </Button>
      </form>
    </div>
  );
}

function WorkRowForm({ row, timeZone }: { row: WorkAdjustmentRow; timeZone: string }) {
  const router = useRouter();
  const [startedAtValue, setStartedAtValue] = useState(() =>
    toDateTimeInputValue(row.startedAtIso, timeZone),
  );
  const [endedAtValue, setEndedAtValue] = useState(() =>
    toDateTimeInputValue(row.endedAtIso, timeZone),
  );
  const [state, formAction] = useActionState(updateWorkEntryAction, initialState);
  const [deleteState, deleteFormAction] = useActionState(
    deleteWorkEntryAction,
    initialState,
  );
  const duration = useMemo(
    () => formatDuration(row.startedAtIso, row.endedAtIso),
    [row.endedAtIso, row.startedAtIso],
  );

  useEffect(() => {
    if (state.success || deleteState.success) {
      router.refresh();
    }
  }, [deleteState.success, router, state.success]);

  return (
    <div className="space-y-2 rounded-xl border bg-surface p-3">
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="entryId" value={row.id} />
        <div className="text-xs text-foreground-muted">
          <span className="font-semibold text-foreground">{row.workOrderTitle}</span>
          <span> </span>
          <span>({duration})</span>
        </div>
        <div className="text-xs text-foreground-muted">
          <span>{formatDateTime(row.startedAtIso, timeZone)}</span>
          <span> to </span>
          <span>{row.endedAtIso ? formatDateTime(row.endedAtIso, timeZone) : "Active"}</span>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <DateTime24Field
            name="startedAt"
            label="Start time"
            value={startedAtValue}
            onChange={setStartedAtValue}
            required
          />
          <DateTime24Field
            name="endedAt"
            label="Stop time (blank = active)"
            value={endedAtValue}
            onChange={setEndedAtValue}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border px-2 py-1 text-xs text-foreground-muted hover:bg-accent-soft"
            onClick={() => setStartedAtValue(nowDateTimeInputValue(timeZone))}
          >
            Start now
          </button>
          <button
            type="button"
            className="rounded-lg border px-2 py-1 text-xs text-foreground-muted hover:bg-accent-soft"
            onClick={() => setEndedAtValue(nowDateTimeInputValue(timeZone))}
          >
            Stop now
          </button>
          <button
            type="button"
            className="rounded-lg border px-2 py-1 text-xs text-foreground-muted hover:bg-accent-soft"
            onClick={() =>
              setEndedAtValue(addMinutesToInputValue(startedAtValue, 30, timeZone))
            }
          >
            +30m from start
          </button>
          <button
            type="button"
            className="rounded-lg border px-2 py-1 text-xs text-foreground-muted hover:bg-accent-soft"
            onClick={() =>
              setEndedAtValue(addMinutesToInputValue(startedAtValue, 60, timeZone))
            }
          >
            +1h from start
          </button>
          <button
            type="button"
            className="rounded-lg border px-2 py-1 text-xs text-foreground-muted hover:bg-accent-soft"
            onClick={() => setEndedAtValue("")}
          >
            Clear stop
          </button>
        </div>
        {state.error ? <p className="text-xs font-medium text-danger">{state.error}</p> : null}
        {state.success ? <p className="text-xs font-medium text-accent">{state.success}</p> : null}
        <Button size="sm" variant="secondary" type="submit">
          Save work entry
        </Button>
      </form>

      <form
        action={deleteFormAction}
        className="border-t border-border/60 pt-2"
        onSubmit={(event) => {
          const confirmed = window.confirm(
            "Delete this work timer entry permanently? This updates payroll totals and cannot be undone.",
          );
          if (!confirmed) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="entryId" value={row.id} />
        {deleteState.error ? (
          <p className="mb-2 text-xs font-medium text-danger">{deleteState.error}</p>
        ) : null}
        {deleteState.success ? (
          <p className="mb-2 text-xs font-medium text-accent">{deleteState.success}</p>
        ) : null}
        <Button size="sm" variant="danger" type="submit">
          Delete work entry
        </Button>
      </form>
    </div>
  );
}

function CreateShiftForm({ membershipId, timeZone }: { membershipId: string; timeZone: string }) {
  const router = useRouter();
  const [startedAtValue, setStartedAtValue] = useState(() =>
    nowDateTimeInputValue(timeZone),
  );
  const [endedAtValue, setEndedAtValue] = useState("");
  const [state, formAction] = useActionState(createShiftEntryAction, initialState);

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [router, state.success]);

  return (
    <form action={formAction} className="space-y-2 rounded-xl border border-accent/25 bg-accent-soft p-3">
      <input type="hidden" name="membershipId" value={membershipId} />
      <p className="text-xs font-semibold text-foreground">Add manual shift entry</p>
      <div className="grid gap-2 md:grid-cols-2">
        <DateTime24Field
          name="startedAt"
          label="Clock in"
          value={startedAtValue}
          onChange={setStartedAtValue}
          required
        />
        <DateTime24Field
          name="endedAt"
          label="Clock out (optional)"
          value={endedAtValue}
          onChange={setEndedAtValue}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border px-2 py-1 text-xs text-foreground-muted hover:bg-accent-soft"
          onClick={() => setStartedAtValue(nowDateTimeInputValue(timeZone))}
        >
          Start now
        </button>
        <button
          type="button"
          className="rounded-lg border px-2 py-1 text-xs text-foreground-muted hover:bg-accent-soft"
          onClick={() => setStartedAtValue(todayAtHourInputValue(7, timeZone))}
        >
          Start 07:00
        </button>
        <button
          type="button"
          className="rounded-lg border px-2 py-1 text-xs text-foreground-muted hover:bg-accent-soft"
          onClick={() => setEndedAtValue(nowDateTimeInputValue(timeZone))}
        >
          End now
        </button>
        <button
          type="button"
          className="rounded-lg border px-2 py-1 text-xs text-foreground-muted hover:bg-accent-soft"
          onClick={() => setEndedAtValue(addMinutesToInputValue(startedAtValue, 60, timeZone))}
        >
          +1h from in
        </button>
        <button
          type="button"
          className="rounded-lg border px-2 py-1 text-xs text-foreground-muted hover:bg-accent-soft"
          onClick={() => setEndedAtValue(addMinutesToInputValue(startedAtValue, 8 * 60, timeZone))}
        >
          +8h from in
        </button>
        <button
          type="button"
          className="rounded-lg border px-2 py-1 text-xs text-foreground-muted hover:bg-accent-soft"
          onClick={() => setEndedAtValue("")}
        >
          Clear out
        </button>
      </div>
      {state.error ? <p className="text-xs font-medium text-danger">{state.error}</p> : null}
      {state.success ? <p className="text-xs font-medium text-accent">{state.success}</p> : null}
      <Button size="sm" type="submit">
        Create shift entry
      </Button>
    </form>
  );
}

export function TimeEntryAdjustments({
  membershipId,
  shiftRows,
  workRows,
  timeZone,
}: TimeEntryAdjustmentsProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="space-y-3">
        <p className="text-sm font-semibold">Shift entries</p>
        <CreateShiftForm membershipId={membershipId} timeZone={timeZone} />
        {shiftRows.length ? (
          <div className="space-y-2">
            {shiftRows.map((row) => (
              <ShiftRowForm key={row.id} row={row} timeZone={timeZone} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-foreground-muted">No shift entries yet.</p>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold">Work timer entries</p>
        {workRows.length ? (
          <div className="space-y-2">
            {workRows.map((row) => (
              <WorkRowForm key={row.id} row={row} timeZone={timeZone} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-foreground-muted">No work timer entries yet.</p>
        )}
      </div>
    </div>
  );
}
