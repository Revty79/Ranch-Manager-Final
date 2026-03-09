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

function parseDateTimeLocalInput(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/,
  );
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);

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
        <label className="space-y-1 text-xs">
          <span className="text-foreground-muted">Clock in</span>
          <input
            name="startedAt"
            type="datetime-local"
            value={startedAtValue}
            step={60}
            onChange={(event) => setStartedAtValue(event.target.value)}
            className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
            required
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-foreground-muted">Clock out (blank = active)</span>
          <input
            name="endedAt"
            type="datetime-local"
            value={endedAtValue}
            step={60}
            onChange={(event) => setEndedAtValue(event.target.value)}
            className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
          />
        </label>
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
        <label className="space-y-1 text-xs">
          <span className="text-foreground-muted">Start time</span>
          <input
            name="startedAt"
            type="datetime-local"
            value={startedAtValue}
            step={60}
            onChange={(event) => setStartedAtValue(event.target.value)}
            className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
            required
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-foreground-muted">Stop time (blank = active)</span>
          <input
            name="endedAt"
            type="datetime-local"
            value={endedAtValue}
            step={60}
            onChange={(event) => setEndedAtValue(event.target.value)}
            className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
          />
        </label>
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
        <label className="space-y-1 text-xs">
          <span className="text-foreground-muted">Clock in</span>
          <input
            name="startedAt"
            type="datetime-local"
            value={startedAtValue}
            step={60}
            onChange={(event) => setStartedAtValue(event.target.value)}
            className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
            required
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-foreground-muted">Clock out (optional)</span>
          <input
            name="endedAt"
            type="datetime-local"
            value={endedAtValue}
            step={60}
            onChange={(event) => setEndedAtValue(event.target.value)}
            className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
          />
        </label>
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
