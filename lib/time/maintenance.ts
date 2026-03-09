import { and, eq, inArray, isNull, lt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { ranchMemberships, shifts, workTimeEntries } from "@/lib/db/schema";

function startOfCurrentUtcDay(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
  );
}

function endOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

function elapsedSeconds(start: Date, end: Date): number {
  return Math.max(Math.floor((end.getTime() - start.getTime()) / 1000), 0);
}

function computeShiftCloseState(
  startedAt: Date,
  pausedAt: Date | null,
  pausedAccumulatedSeconds: number,
  fallbackCloseTime: Date,
): {
  endedAt: Date;
  pausedAt: null;
  pausedAccumulatedSeconds: number;
} {
  const dayEnd = endOfUtcDay(startedAt);
  const endedAt = dayEnd < fallbackCloseTime ? dayEnd : fallbackCloseTime;
  const additionalPausedSeconds =
    pausedAt && pausedAt < endedAt ? elapsedSeconds(pausedAt, endedAt) : 0;

  return {
    endedAt,
    pausedAt: null,
    pausedAccumulatedSeconds: pausedAccumulatedSeconds + additionalPausedSeconds,
  };
}

export async function autoClockOutActiveTimeForUser(userId: string): Promise<void> {
  const memberships = await db
    .select({
      membershipId: ranchMemberships.id,
      ranchId: ranchMemberships.ranchId,
    })
    .from(ranchMemberships)
    .where(and(eq(ranchMemberships.userId, userId), eq(ranchMemberships.isActive, true)));

  if (!memberships.length) {
    return;
  }

  const membershipIds = memberships.map((membership) => membership.membershipId);
  const membershipById = new Map(memberships.map((membership) => [membership.membershipId, membership]));
  const closeTime = new Date();

  const [activeShifts, activeWorkEntries] = await Promise.all([
    db
      .select({
        id: shifts.id,
        membershipId: shifts.membershipId,
        startedAt: shifts.startedAt,
        pausedAt: shifts.pausedAt,
        pausedAccumulatedSeconds: shifts.pausedAccumulatedSeconds,
      })
      .from(shifts)
      .where(
        and(
          inArray(shifts.membershipId, membershipIds),
          isNull(shifts.endedAt),
        ),
      ),
    db
      .select({
        id: workTimeEntries.id,
        membershipId: workTimeEntries.membershipId,
        startedAt: workTimeEntries.startedAt,
      })
      .from(workTimeEntries)
      .where(
        and(
          inArray(workTimeEntries.membershipId, membershipIds),
          isNull(workTimeEntries.endedAt),
        ),
      ),
  ]);

  if (!activeShifts.length && !activeWorkEntries.length) {
    return;
  }

  await db.transaction(async (tx) => {
    for (const shift of activeShifts) {
      const membership = membershipById.get(shift.membershipId);
      if (!membership) {
        continue;
      }

      const closeState = computeShiftCloseState(
        shift.startedAt,
        shift.pausedAt,
        shift.pausedAccumulatedSeconds,
        closeTime,
      );

      await tx
        .update(shifts)
        .set(closeState)
        .where(
          and(
            eq(shifts.id, shift.id),
            eq(shifts.ranchId, membership.ranchId),
            eq(shifts.membershipId, shift.membershipId),
            isNull(shifts.endedAt),
          ),
        );
    }

    for (const entry of activeWorkEntries) {
      const membership = membershipById.get(entry.membershipId);
      if (!membership) {
        continue;
      }

      const dayEnd = endOfUtcDay(entry.startedAt);
      const endedAt = dayEnd < closeTime ? dayEnd : closeTime;

      await tx
        .update(workTimeEntries)
        .set({
          endedAt,
        })
        .where(
          and(
            eq(workTimeEntries.id, entry.id),
            eq(workTimeEntries.ranchId, membership.ranchId),
            eq(workTimeEntries.membershipId, entry.membershipId),
            isNull(workTimeEntries.endedAt),
          ),
        );
    }
  });
}

export async function forceClockOutAllActiveTimeForRanch(
  ranchId: string,
  closeTime = new Date(),
): Promise<void> {
  const [activeShifts, activeWorkEntries] = await Promise.all([
    db
      .select({
        id: shifts.id,
        membershipId: shifts.membershipId,
        startedAt: shifts.startedAt,
        pausedAt: shifts.pausedAt,
        pausedAccumulatedSeconds: shifts.pausedAccumulatedSeconds,
      })
      .from(shifts)
      .where(and(eq(shifts.ranchId, ranchId), isNull(shifts.endedAt))),
    db
      .select({
        id: workTimeEntries.id,
        membershipId: workTimeEntries.membershipId,
        startedAt: workTimeEntries.startedAt,
      })
      .from(workTimeEntries)
      .where(and(eq(workTimeEntries.ranchId, ranchId), isNull(workTimeEntries.endedAt))),
  ]);

  if (!activeShifts.length && !activeWorkEntries.length) {
    return;
  }

  await db.transaction(async (tx) => {
    for (const shift of activeShifts) {
      const closeState = computeShiftCloseState(
        shift.startedAt,
        shift.pausedAt,
        shift.pausedAccumulatedSeconds,
        closeTime,
      );

      await tx
        .update(shifts)
        .set(closeState)
        .where(
          and(
            eq(shifts.id, shift.id),
            eq(shifts.ranchId, ranchId),
            eq(shifts.membershipId, shift.membershipId),
            isNull(shifts.endedAt),
          ),
        );
    }

    for (const entry of activeWorkEntries) {
      const dayEnd = endOfUtcDay(entry.startedAt);
      const endedAt = dayEnd < closeTime ? dayEnd : closeTime;

      await tx
        .update(workTimeEntries)
        .set({
          endedAt,
        })
        .where(
          and(
            eq(workTimeEntries.id, entry.id),
            eq(workTimeEntries.ranchId, ranchId),
            eq(workTimeEntries.membershipId, entry.membershipId),
            isNull(workTimeEntries.endedAt),
          ),
        );
    }
  });
}

export async function autoCloseStaleTimeEntriesForRanch(
  ranchId: string,
  now = new Date(),
): Promise<void> {
  const dayStart = startOfCurrentUtcDay(now);
  const [staleShifts, staleWorkEntries] = await Promise.all([
    db
      .select({
        id: shifts.id,
        membershipId: shifts.membershipId,
        startedAt: shifts.startedAt,
        pausedAt: shifts.pausedAt,
        pausedAccumulatedSeconds: shifts.pausedAccumulatedSeconds,
      })
      .from(shifts)
      .where(
        and(
          eq(shifts.ranchId, ranchId),
          isNull(shifts.endedAt),
          lt(shifts.startedAt, dayStart),
        ),
      ),
    db
      .select({
        id: workTimeEntries.id,
        membershipId: workTimeEntries.membershipId,
        startedAt: workTimeEntries.startedAt,
      })
      .from(workTimeEntries)
      .where(
        and(
          eq(workTimeEntries.ranchId, ranchId),
          isNull(workTimeEntries.endedAt),
          lt(workTimeEntries.startedAt, dayStart),
        ),
      ),
  ]);

  if (!staleShifts.length && !staleWorkEntries.length) {
    return;
  }

  await db.transaction(async (tx) => {
    for (const shift of staleShifts) {
      const closeState = computeShiftCloseState(
        shift.startedAt,
        shift.pausedAt,
        shift.pausedAccumulatedSeconds,
        now,
      );

      await tx
        .update(shifts)
        .set(closeState)
        .where(
          and(
            eq(shifts.id, shift.id),
            eq(shifts.ranchId, ranchId),
            eq(shifts.membershipId, shift.membershipId),
            isNull(shifts.endedAt),
          ),
        );
    }

    for (const entry of staleWorkEntries) {
      const dayEnd = endOfUtcDay(entry.startedAt);
      const endedAt = dayEnd < now ? dayEnd : now;

      await tx
        .update(workTimeEntries)
        .set({
          endedAt,
        })
        .where(
          and(
            eq(workTimeEntries.id, entry.id),
            eq(workTimeEntries.ranchId, ranchId),
            eq(workTimeEntries.membershipId, entry.membershipId),
            isNull(workTimeEntries.endedAt),
          ),
        );
    }
  });
}

export async function autoCloseStaleTimeEntriesForAllRanches(
  now = new Date(),
): Promise<number> {
  const [shiftRanches, workRanches] = await Promise.all([
    db
      .select({
        ranchId: shifts.ranchId,
      })
      .from(shifts)
      .where(isNull(shifts.endedAt)),
    db
      .select({
        ranchId: workTimeEntries.ranchId,
      })
      .from(workTimeEntries)
      .where(isNull(workTimeEntries.endedAt)),
  ]);

  const ranchIds = new Set<string>([
    ...shiftRanches.map((row) => row.ranchId),
    ...workRanches.map((row) => row.ranchId),
  ]);

  for (const ranchId of ranchIds) {
    await autoCloseStaleTimeEntriesForRanch(ranchId, now);
  }

  return ranchIds.size;
}

export async function forceClockOutAllActiveTimeForAllRanches(
  closeTime = new Date(),
): Promise<number> {
  const [shiftRanches, workRanches] = await Promise.all([
    db
      .select({
        ranchId: shifts.ranchId,
      })
      .from(shifts)
      .where(isNull(shifts.endedAt)),
    db
      .select({
        ranchId: workTimeEntries.ranchId,
      })
      .from(workTimeEntries)
      .where(isNull(workTimeEntries.endedAt)),
  ]);

  const ranchIds = new Set<string>([
    ...shiftRanches.map((row) => row.ranchId),
    ...workRanches.map((row) => row.ranchId),
  ]);

  for (const ranchId of ranchIds) {
    await forceClockOutAllActiveTimeForRanch(ranchId, closeTime);
  }

  return ranchIds.size;
}
