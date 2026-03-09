"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createShiftEntryAction,
  updateShiftEntryAction,
  updateWorkEntryAction,
} from "@/lib/time/admin-actions";
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

function toDateTime24String(value: Date): string {
  const year = value.getFullYear();
  const month = pad(value.getMonth() + 1);
  const day = pad(value.getDate());
  const hours = pad(value.getHours());
  const minutes = pad(value.getMinutes());
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function toDateTimeLocalInputString(value: Date): string {
  const year = value.getFullYear();
  const month = pad(value.getMonth() + 1);
  const day = pad(value.getDate());
  const hours = pad(value.getHours());
  const minutes = pad(value.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toDateInputString(value: Date): string {
  const year = value.getFullYear();
  const month = pad(value.getMonth() + 1);
  const day = pad(value.getDate());
  return `${year}-${month}-${day}`;
}

function parseDateTimeLocalInput(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? "0");
  const parsed = new Date(year, month - 1, day, hour, minute, second, 0);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hour ||
    parsed.getMinutes() !== minute
  ) {
    return null;
  }

  return parsed;
}

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

  const parsed = parseDateTimeLocalInput(trimmed);
  if (!parsed) {
    return {
      date: "",
      hour: "00",
      minute: "00",
    };
  }

  return {
    date: toDateInputString(parsed),
    hour: pad(parsed.getHours()),
    minute: pad(parsed.getMinutes()),
  };
}

function toDateTimeLocalInputFromParts(parts: DateTimeParts): string {
  if (!parts.date) {
    return "";
  }

  return `${parts.date}T${parts.hour}:${parts.minute}`;
}

function toDateTimeInputValue(isoValue: string | null): string {
  if (!isoValue) {
    return "";
  }

  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return toDateTimeLocalInputString(date);
}

function nowLocalDateTimeInputValue(): string {
  return toDateTimeLocalInputString(new Date());
}

function addMinutesToInputValue(
  inputValue: string,
  minutesToAdd: number,
): string {
  const base = parseDateTimeLocalInput(inputValue) ?? new Date();
  const shifted = new Date(base.getTime() + minutesToAdd * 60_000);
  return toDateTimeLocalInputString(shifted);
}

function todayAtHourInputValue(hour24: number): string {
  const now = new Date();
  const value = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hour24,
    0,
    0,
    0,
  );
  return toDateTimeLocalInputString(value);
}

function formatDateTime(isoValue: string): string {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return toDateTime24String(date);
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

function ShiftRowForm({ row }: { row: ShiftAdjustmentRow }) {
  const router = useRouter();
  const [startedAtValue, setStartedAtValue] = useState(() =>
    toDateTimeInputValue(row.startedAtIso),
  );
  const [endedAtValue, setEndedAtValue] = useState(() =>
    toDateTimeInputValue(row.endedAtIso),
  );
  const [state, formAction] = useActionState(updateShiftEntryAction, initialState);
  const duration = useMemo(
    () => formatDuration(row.startedAtIso, row.endedAtIso),
    [row.endedAtIso, row.startedAtIso],
  );

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [router, state.success]);

  return (
    <form action={formAction} className="space-y-2 rounded-xl border bg-surface p-3">
      <input type="hidden" name="entryId" value={row.id} />
      <div className="text-xs text-foreground-muted">
        <span>{formatDateTime(row.startedAtIso)}</span>
        <span> to </span>
        <span>{row.endedAtIso ? formatDateTime(row.endedAtIso) : "Active"}</span>
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
          onClick={() => setStartedAtValue(nowLocalDateTimeInputValue())}
        >
          Clock in now
        </button>
        <button
          type="button"
          className="rounded-lg border px-2 py-1 text-xs text-foreground-muted hover:bg-accent-soft"
          onClick={() => setEndedAtValue(nowLocalDateTimeInputValue())}
        >
          Clock out now
        </button>
        <button
          type="button"
          className="rounded-lg border px-2 py-1 text-xs text-foreground-muted hover:bg-accent-soft"
          onClick={() => setEndedAtValue(addMinutesToInputValue(startedAtValue, 30))}
        >
          +30m from in
        </button>
        <button
          type="button"
          className="rounded-lg border px-2 py-1 text-xs text-foreground-muted hover:bg-accent-soft"
          onClick={() => setEndedAtValue(addMinutesToInputValue(startedAtValue, 60))}
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
  );
}

function WorkRowForm({ row }: { row: WorkAdjustmentRow }) {
  const router = useRouter();
  const [startedAtValue, setStartedAtValue] = useState(() =>
    toDateTimeInputValue(row.startedAtIso),
  );
  const [endedAtValue, setEndedAtValue] = useState(() =>
    toDateTimeInputValue(row.endedAtIso),
  );
  const [state, formAction] = useActionState(updateWorkEntryAction, initialState);
  const duration = useMemo(
    () => formatDuration(row.startedAtIso, row.endedAtIso),
    [row.endedAtIso, row.startedAtIso],
  );

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [router, state.success]);

  return (
    <form action={formAction} className="space-y-2 rounded-xl border bg-surface p-3">
      <input type="hidden" name="entryId" value={row.id} />
      <div className="text-xs text-foreground-muted">
        <span className="font-semibold text-foreground">{row.workOrderTitle}</span>
        <span> </span>
        <span>({duration})</span>
      </div>
      <div className="text-xs text-foreground-muted">
        <span>{formatDateTime(row.startedAtIso)}</span>
        <span> to </span>
        <span>{row.endedAtIso ? formatDateTime(row.endedAtIso) : "Active"}</span>
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
          onClick={() => setStartedAtValue(nowLocalDateTimeInputValue())}
        >
          Start now
        </button>
        <button
          type="button"
          className="rounded-lg border px-2 py-1 text-xs text-foreground-muted hover:bg-accent-soft"
          onClick={() => setEndedAtValue(nowLocalDateTimeInputValue())}
        >
          Stop now
        </button>
        <button
          type="button"
          className="rounded-lg border px-2 py-1 text-xs text-foreground-muted hover:bg-accent-soft"
          onClick={() => setEndedAtValue(addMinutesToInputValue(startedAtValue, 30))}
        >
          +30m from start
        </button>
        <button
          type="button"
          className="rounded-lg border px-2 py-1 text-xs text-foreground-muted hover:bg-accent-soft"
          onClick={() => setEndedAtValue(addMinutesToInputValue(startedAtValue, 60))}
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
  );
}

function CreateShiftForm({ membershipId }: { membershipId: string }) {
  const router = useRouter();
  const [startedAtValue, setStartedAtValue] = useState(() =>
    nowLocalDateTimeInputValue(),
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
          onClick={() => setStartedAtValue(nowLocalDateTimeInputValue())}
        >
          Start now
        </button>
        <button
          type="button"
          className="rounded-lg border px-2 py-1 text-xs text-foreground-muted hover:bg-accent-soft"
          onClick={() => setStartedAtValue(todayAtHourInputValue(7))}
        >
          Start 07:00
        </button>
        <button
          type="button"
          className="rounded-lg border px-2 py-1 text-xs text-foreground-muted hover:bg-accent-soft"
          onClick={() => setEndedAtValue(nowLocalDateTimeInputValue())}
        >
          End now
        </button>
        <button
          type="button"
          className="rounded-lg border px-2 py-1 text-xs text-foreground-muted hover:bg-accent-soft"
          onClick={() => setEndedAtValue(addMinutesToInputValue(startedAtValue, 60))}
        >
          +1h from in
        </button>
        <button
          type="button"
          className="rounded-lg border px-2 py-1 text-xs text-foreground-muted hover:bg-accent-soft"
          onClick={() => setEndedAtValue(addMinutesToInputValue(startedAtValue, 8 * 60))}
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
}: TimeEntryAdjustmentsProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="space-y-3">
        <p className="text-sm font-semibold">Shift entries</p>
        <CreateShiftForm membershipId={membershipId} />
        {shiftRows.length ? (
          <div className="space-y-2">
            {shiftRows.map((row) => (
              <ShiftRowForm key={row.id} row={row} />
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
              <WorkRowForm key={row.id} row={row} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-foreground-muted">No work timer entries yet.</p>
        )}
      </div>
    </div>
  );
}
