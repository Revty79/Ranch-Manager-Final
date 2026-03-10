"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateUserTimeZoneAction,
  type SettingsActionState,
} from "@/lib/settings/actions";
import { Button } from "@/components/ui/button";

const initialState: SettingsActionState = {};
const fallbackTimeZones = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
];

interface TimeZoneFormProps {
  currentTimeZone: string;
}

export function TimeZoneForm({ currentTimeZone }: TimeZoneFormProps) {
  const router = useRouter();
  const [timeZone, setTimeZone] = useState(currentTimeZone);
  const [state, formAction] = useActionState(updateUserTimeZoneAction, initialState);

  const supportedTimeZones = useMemo(() => {
    if (typeof Intl.supportedValuesOf === "function") {
      try {
        const values = Intl.supportedValuesOf("timeZone");
        if (values.length) {
          return values;
        }
      } catch {
        // Fall through to fallback list.
      }
    }

    return fallbackTimeZones;
  }, []);

  useEffect(() => {
    setTimeZone(currentTimeZone);
  }, [currentTimeZone]);

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [router, state.success]);

  const browserTimeZone = useMemo(() => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }, []);

  return (
    <form action={formAction} className="space-y-3">
      <label className="space-y-1 text-sm">
        <span className="text-foreground-muted">Timezone</span>
        <input
          name="timeZone"
          value={timeZone}
          onChange={(event) => setTimeZone(event.target.value)}
          list="timezone-options"
          className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
          placeholder="America/Denver"
          required
        />
        <datalist id="timezone-options">
          {supportedTimeZones.map((zone) => (
            <option key={zone} value={zone} />
          ))}
        </datalist>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="secondary">
          Save timezone
        </Button>
        {browserTimeZone ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setTimeZone(browserTimeZone)}
          >
            Use browser timezone
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-foreground-muted">
        Current timezone: {currentTimeZone}
        {browserTimeZone ? ` | Browser timezone: ${browserTimeZone}` : ""}
      </p>
      {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
      {state.success ? <p className="text-sm font-medium text-accent">{state.success}</p> : null}
    </form>
  );
}
