"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  defaultTimeActionState,
  endShiftAction,
  endWorkSessionAction,
  startShiftAction,
  startWorkSessionAction,
} from "@/lib/time/actions";
import type { ShiftRecord, WorkOrderOption, WorkSessionRecord } from "@/lib/time/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";

interface TimeControlPanelProps {
  activeShift: ShiftRecord | null;
  activeWork: WorkSessionRecord | null;
  workOrderOptions: WorkOrderOption[];
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function TimeControlPanel({
  activeShift,
  activeWork,
  workOrderOptions,
}: TimeControlPanelProps) {
  const router = useRouter();
  const [startShiftState, startShiftFormAction] = useActionState(
    startShiftAction,
    defaultTimeActionState,
  );
  const [endShiftState, endShiftFormAction] = useActionState(
    endShiftAction,
    defaultTimeActionState,
  );
  const [startWorkState, startWorkFormAction] = useActionState(
    startWorkSessionAction,
    defaultTimeActionState,
  );
  const [endWorkState, endWorkFormAction] = useActionState(
    endWorkSessionAction,
    defaultTimeActionState,
  );

  useEffect(() => {
    if (
      startShiftState.success ||
      endShiftState.success ||
      startWorkState.success ||
      endWorkState.success
    ) {
      router.refresh();
    }
  }, [
    endShiftState.success,
    endWorkState.success,
    router,
    startShiftState.success,
    startWorkState.success,
  ]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardContent className="space-y-4 py-6">
          <div>
            <CardTitle className="text-base">Shift status</CardTitle>
            <CardDescription>
              {activeShift
                ? `Shift started at ${formatTime(activeShift.startedAt)}`
                : "No active shift"}
            </CardDescription>
          </div>
          <div className="space-y-2">
            {startShiftState.error ? (
              <p className="text-sm font-medium text-danger">{startShiftState.error}</p>
            ) : null}
            {endShiftState.error ? (
              <p className="text-sm font-medium text-danger">{endShiftState.error}</p>
            ) : null}
            <form action={activeShift ? endShiftFormAction : startShiftFormAction}>
              <Button variant={activeShift ? "danger" : "primary"} type="submit">
                {activeShift ? "End shift" : "Start shift"}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 py-6">
          <div>
            <CardTitle className="text-base">Work timer</CardTitle>
            <CardDescription>
              {activeWork
                ? `Tracking ${activeWork.workOrderTitle} since ${formatTime(activeWork.startedAt)}`
                : "No active work timer"}
            </CardDescription>
          </div>
          <div className="space-y-2">
            {startWorkState.error ? (
              <p className="text-sm font-medium text-danger">{startWorkState.error}</p>
            ) : null}
            {endWorkState.error ? (
              <p className="text-sm font-medium text-danger">{endWorkState.error}</p>
            ) : null}
            {activeWork ? (
              <form action={endWorkFormAction}>
                <Button variant="secondary" type="submit">
                  Stop work timer
                </Button>
              </form>
            ) : (
              workOrderOptions.length ? (
                <form action={startWorkFormAction} className="space-y-2">
                  <select
                    name="workOrderId"
                    className="h-10 w-full rounded-xl border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    defaultValue=""
                    required
                  >
                    <option value="" disabled>
                      Select work order
                    </option>
                    {workOrderOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.title}
                      </option>
                    ))}
                  </select>
                  <Button type="submit">Start work timer</Button>
                </form>
              ) : (
                <p className="text-sm text-foreground-muted">
                  No available work orders to track right now.
                </p>
              )
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
