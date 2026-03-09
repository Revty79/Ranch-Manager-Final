"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  completeWorkOrderAction,
  endShiftAction,
  endWorkSessionAction,
  startShiftAction,
  startWorkSessionAction,
  type TimeActionState,
} from "@/lib/time/actions";
import type { PayType } from "@/lib/db/schema";
import type { ShiftRecord, WorkOrderOption, WorkSessionRecord } from "@/lib/time/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";

interface TimeControlPanelProps {
  activeShift: ShiftRecord | null;
  activeWork: WorkSessionRecord | null;
  workOrderOptions: WorkOrderOption[];
  payType: PayType;
}

const initialTimeActionState: TimeActionState = {};

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
  payType,
}: TimeControlPanelProps) {
  const router = useRouter();
  const isPieceWork = payType === "piece_work";
  const [startShiftState, startShiftFormAction] = useActionState(
    startShiftAction,
    initialTimeActionState,
  );
  const [endShiftState, endShiftFormAction] = useActionState(
    endShiftAction,
    initialTimeActionState,
  );
  const [startWorkState, startWorkFormAction] = useActionState(
    startWorkSessionAction,
    initialTimeActionState,
  );
  const [endWorkState, endWorkFormAction] = useActionState(
    endWorkSessionAction,
    initialTimeActionState,
  );
  const [completeOrderState, completeOrderFormAction] = useActionState(
    completeWorkOrderAction,
    initialTimeActionState,
  );

  useEffect(() => {
    if (
      startShiftState.success ||
      endShiftState.success ||
      startWorkState.success ||
      endWorkState.success ||
      completeOrderState.success
    ) {
      router.refresh();
    }
  }, [
    completeOrderState.success,
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
              {isPieceWork
                ? activeShift
                  ? `Legacy shift active since ${formatTime(activeShift.startedAt)}. Clock out to continue piece-work mode.`
                  : "Piece-work mode: no shift required."
                : activeShift
                  ? activeShift.pausedAt
                    ? "Shift is in a paused state. Clock out, then clock back in."
                    : `Clocked in at ${formatTime(activeShift.startedAt)}`
                  : "No active shift"}
            </CardDescription>
          </div>
          <p className="text-xs text-foreground-muted">
            {isPieceWork
              ? "Piece-work pay uses work-order timers only."
              : "For lunch or breaks, clock out and clock back in when you return."}
          </p>
          <div className="space-y-2">
            {startShiftState.error ? (
              <p className="text-sm font-medium text-danger">{startShiftState.error}</p>
            ) : null}
            {endShiftState.error ? (
              <p className="text-sm font-medium text-danger">{endShiftState.error}</p>
            ) : null}
            {activeShift ? (
              <form action={endShiftFormAction}>
                <Button variant="danger" type="submit">
                  Clock out
                </Button>
              </form>
            ) : isPieceWork ? null : (
              <form action={startShiftFormAction}>
                <Button type="submit">Clock in</Button>
              </form>
            )}
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
                : isPieceWork
                  ? "No active work timer. Piece-work tracking starts here."
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
            {completeOrderState.error ? (
              <p className="text-sm font-medium text-danger">{completeOrderState.error}</p>
            ) : null}
            {activeWork ? (
              <div className="flex flex-wrap gap-2">
                <form action={endWorkFormAction}>
                  <Button variant="secondary" type="submit">
                    Stop work timer
                  </Button>
                </form>
                <form action={completeOrderFormAction}>
                  <input type="hidden" name="workOrderId" value={activeWork.workOrderId} />
                  <Button variant="primary" type="submit">
                    Complete work order
                  </Button>
                </form>
              </div>
            ) : (
              workOrderOptions.length ? (
                <div className="space-y-2">
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
                  <form action={completeOrderFormAction} className="space-y-2">
                    <select
                      name="workOrderId"
                      className="h-10 w-full rounded-xl border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      defaultValue=""
                      required
                    >
                      <option value="" disabled>
                        Select work order to complete
                      </option>
                      {workOrderOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.title}
                        </option>
                      ))}
                    </select>
                    <Button variant="secondary" type="submit">
                      Complete selected work order
                    </Button>
                  </form>
                </div>
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
