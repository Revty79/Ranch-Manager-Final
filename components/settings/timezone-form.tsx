"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateUserTimeZoneAction,
  type SettingsActionState,
} from "@/lib/settings/actions";
import { Button } from "@/components/ui/button";

const initialState: SettingsActionState = {};

interface TimeZoneFormProps {
  currentTimeZone: string;
  timeZoneOptions: string[];
}

export function TimeZoneForm({ currentTimeZone, timeZoneOptions }: TimeZoneFormProps) {
  const router = useRouter();
  const [timeZone, setTimeZone] = useState(currentTimeZone);
  const [browserTimeZone, setBrowserTimeZone] = useState<string | null>(null);
  const [state, formAction] = useActionState(updateUserTimeZoneAction, initialState);

  useEffect(() => {
    setTimeZone(currentTimeZone);
  }, [currentTimeZone]);

  useEffect(() => {
    try {
      setBrowserTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {
      setBrowserTimeZone(null);
    }
  }, []);

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [router, state.success]);

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
          {timeZoneOptions.map((zone) => (
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
