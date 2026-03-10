import { Clock3 } from "lucide-react";
import { TimeControlPanel } from "@/components/time/time-control-panel";
import { EmptyState } from "@/components/patterns/empty-state";
import { PageHeader } from "@/components/patterns/page-header";
import { StatCard } from "@/components/patterns/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { requirePaidAccessContext } from "@/lib/auth/context";
import {
  getActiveShiftForMembership,
  getActiveShiftRosterForRanch,
  getActiveWorkSessionForMembership,
  getRecentShiftsForMembership,
  getRecentWorkSessionsForMembership,
  getWorkOrderOptionsForTimeTracking,
} from "@/lib/time/queries";

function formatDateTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

function formatDuration(startedAt: Date, endedAt: Date | null): string {
  const end = endedAt ?? new Date();
  const diffMs = Math.max(end.getTime() - startedAt.getTime(), 0);
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function formatShiftDuration(shift: {
  startedAt: Date;
  endedAt: Date | null;
  pausedAt: Date | null;
  pausedAccumulatedSeconds: number;
}): string {
  const end = shift.endedAt ?? new Date();
  const totalMs = Math.max(end.getTime() - shift.startedAt.getTime(), 0);
  const activePauseMs = shift.pausedAt
    ? Math.max(end.getTime() - shift.pausedAt.getTime(), 0)
    : 0;
  const pauseMs = shift.pausedAccumulatedSeconds * 1000 + activePauseMs;
  const netMs = Math.max(totalMs - pauseMs, 0);
  const totalMinutes = Math.floor(netMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function isWorkerRole(role: "owner" | "manager" | "worker" | "seasonal_worker"): boolean {
  return role === "worker" || role === "seasonal_worker";
}

export default async function TimePage() {
  const context = await requirePaidAccessContext();
  const isPieceWorkMember = context.membership.payType === "piece_work";
  const [activeShift, activeWork, recentShifts, recentWorkSessions, workOrderOptions] =
    await Promise.all([
      getActiveShiftForMembership(context.ranch.id, context.membership.id),
      getActiveWorkSessionForMembership(context.ranch.id, context.membership.id),
      getRecentShiftsForMembership(context.ranch.id, context.membership.id, 12),
      getRecentWorkSessionsForMembership(context.ranch.id, context.membership.id, 12),
      getWorkOrderOptionsForTimeTracking(
        context.ranch.id,
        context.membership.id,
        context.membership.role,
      ),
    ]);

  const activeShiftRoster =
    isWorkerRole(context.membership.role)
      ? []
      : await getActiveShiftRosterForRanch(context.ranch.id);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Time"
        title="Shift & Task Time"
        description="Start and stop shift/work timers with clear state and clean history."
      />

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Current Shift"
          value={
            isPieceWorkMember
              ? activeShift
                ? activeShift.pausedAt
                  ? "Legacy paused"
                  : "Legacy active"
                : "Not required"
              : activeShift
                ? activeShift.pausedAt
                  ? "Paused"
                  : "Active"
                : "Not started"
          }
          trend={
            activeShift
              ? activeShift.pausedAt
                ? `Paused since ${formatDateTime(activeShift.pausedAt, context.user.timeZone)}`
                : `Since ${formatDateTime(activeShift.startedAt, context.user.timeZone)}`
              : isPieceWorkMember
                ? "Piece-work mode uses work timers"
              : undefined
          }
        />
        <StatCard
          label="Active Work"
          value={activeWork ? activeWork.workOrderTitle : "None"}
          trend={
            activeWork
              ? `Started ${formatDateTime(activeWork.startedAt, context.user.timeZone)}`
              : undefined
          }
        />
        <StatCard
          label="Recent Sessions"
          value={`${recentWorkSessions.length}`}
          trend="Last 12 entries"
        />
      </section>

      <TimeControlPanel
        activeShift={activeShift}
        activeWork={activeWork}
        workOrderOptions={workOrderOptions}
        payType={context.membership.payType}
        timeZone={context.user.timeZone}
      />

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 py-6">
            <div>
              <CardTitle className="text-base">Shift history</CardTitle>
              <CardDescription>Recent shift sessions for your membership.</CardDescription>
            </div>
            {recentShifts.length ? (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Started</TableHeaderCell>
                      <TableHeaderCell>Ended</TableHeaderCell>
                      <TableHeaderCell>Duration</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentShifts.map((shift) => (
                      <TableRow key={shift.id}>
                        <TableCell>{formatDateTime(shift.startedAt, context.user.timeZone)}</TableCell>
                        <TableCell>
                          {shift.endedAt
                            ? formatDateTime(shift.endedAt, context.user.timeZone)
                            : shift.pausedAt
                              ? "Paused"
                              : "Active"}
                        </TableCell>
                        <TableCell>{formatShiftDuration(shift)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <EmptyState
                title="No shift history yet"
                description={
                  isPieceWorkMember
                    ? "Piece-work mode does not require shift clock-ins."
                    : "Start your first shift to begin tracking hours."
                }
                icon={<Clock3 className="h-5 w-5 text-accent" />}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 py-6">
            <div>
              <CardTitle className="text-base">Work timer history</CardTitle>
              <CardDescription>Recent work-order time sessions.</CardDescription>
            </div>
            {recentWorkSessions.length ? (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Work Order</TableHeaderCell>
                      <TableHeaderCell>Started</TableHeaderCell>
                      <TableHeaderCell>Duration</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentWorkSessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span>{session.workOrderTitle}</span>
                            <Badge variant="neutral" className="w-fit">
                              {session.status.replace("_", " ")}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>{formatDateTime(session.startedAt, context.user.timeZone)}</TableCell>
                        <TableCell>
                          {formatDuration(session.startedAt, session.endedAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <EmptyState
                title="No work timer history yet"
                description={
                  isPieceWorkMember
                    ? "Start a work timer on a work order to record piece-work time."
                    : "Start a work timer during an active shift to record task time."
                }
                icon={<Clock3 className="h-5 w-5 text-accent" />}
              />
            )}
          </CardContent>
        </Card>
      </section>

      {!isWorkerRole(context.membership.role) ? (
        <Card>
          <CardContent className="space-y-3 py-6">
            <div>
              <CardTitle className="text-base">Team active shift state</CardTitle>
              <CardDescription>Live visibility into who is currently on shift.</CardDescription>
            </div>
            {activeShiftRoster.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {activeShiftRoster.map((item) => (
                  <div key={item.membershipId} className="rounded-xl border bg-surface p-3">
                    <p className="font-semibold">{item.memberName}</p>
                    <p className="text-sm text-foreground-muted">
                      Shift started: {formatDateTime(item.shiftStartedAt, context.user.timeZone)}
                    </p>
                    <p className="text-sm text-foreground-muted">
                      Status: {item.isPaused ? "Paused" : "Active"}
                    </p>
                    <p className="text-sm text-foreground-muted">
                      Active work: {item.activeWorkTitle ?? "No active work timer"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-foreground-muted">No team members currently on shift.</p>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
