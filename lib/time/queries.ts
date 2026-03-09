import {
  and,
  desc,
  eq,
  inArray,
  isNull,
  notInArray,
} from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  ranchMemberships,
  shifts,
  users,
  workOrderAssignments,
  workOrders,
  workTimeEntries,
  type RanchRole,
  type WorkOrderStatus,
} from "@/lib/db/schema";

export interface ShiftRecord {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
}

export interface WorkSessionRecord {
  id: string;
  workOrderId: string;
  workOrderTitle: string;
  status: WorkOrderStatus;
  startedAt: Date;
  endedAt: Date | null;
}

export interface WorkOrderOption {
  id: string;
  title: string;
  status: WorkOrderStatus;
}

export interface ActiveShiftRosterItem {
  membershipId: string;
  memberName: string;
  role: RanchRole;
  shiftStartedAt: Date;
  activeWorkTitle: string | null;
}

export async function getActiveShiftForMembership(
  ranchId: string,
  membershipId: string,
): Promise<ShiftRecord | null> {
  const [row] = await db
    .select({
      id: shifts.id,
      startedAt: shifts.startedAt,
      endedAt: shifts.endedAt,
    })
    .from(shifts)
    .where(
      and(
        eq(shifts.ranchId, ranchId),
        eq(shifts.membershipId, membershipId),
        isNull(shifts.endedAt),
      ),
    )
    .orderBy(desc(shifts.startedAt))
    .limit(1);

  return row ?? null;
}

export async function getRecentShiftsForMembership(
  ranchId: string,
  membershipId: string,
  limit = 10,
): Promise<ShiftRecord[]> {
  return db
    .select({
      id: shifts.id,
      startedAt: shifts.startedAt,
      endedAt: shifts.endedAt,
    })
    .from(shifts)
    .where(and(eq(shifts.ranchId, ranchId), eq(shifts.membershipId, membershipId)))
    .orderBy(desc(shifts.startedAt))
    .limit(limit);
}

export async function getActiveWorkSessionForMembership(
  ranchId: string,
  membershipId: string,
): Promise<WorkSessionRecord | null> {
  const [row] = await db
    .select({
      id: workTimeEntries.id,
      workOrderId: workOrders.id,
      workOrderTitle: workOrders.title,
      status: workOrders.status,
      startedAt: workTimeEntries.startedAt,
      endedAt: workTimeEntries.endedAt,
    })
    .from(workTimeEntries)
    .innerJoin(workOrders, eq(workTimeEntries.workOrderId, workOrders.id))
    .where(
      and(
        eq(workTimeEntries.ranchId, ranchId),
        eq(workTimeEntries.membershipId, membershipId),
        isNull(workTimeEntries.endedAt),
      ),
    )
    .orderBy(desc(workTimeEntries.startedAt))
    .limit(1);

  return row ?? null;
}

export async function getRecentWorkSessionsForMembership(
  ranchId: string,
  membershipId: string,
  limit = 10,
): Promise<WorkSessionRecord[]> {
  return db
    .select({
      id: workTimeEntries.id,
      workOrderId: workOrders.id,
      workOrderTitle: workOrders.title,
      status: workOrders.status,
      startedAt: workTimeEntries.startedAt,
      endedAt: workTimeEntries.endedAt,
    })
    .from(workTimeEntries)
    .innerJoin(workOrders, eq(workTimeEntries.workOrderId, workOrders.id))
    .where(
      and(
        eq(workTimeEntries.ranchId, ranchId),
        eq(workTimeEntries.membershipId, membershipId),
      ),
    )
    .orderBy(desc(workTimeEntries.startedAt))
    .limit(limit);
}

export async function getWorkOrderOptionsForTimeTracking(
  ranchId: string,
  membershipId: string,
  role: RanchRole,
): Promise<WorkOrderOption[]> {
  if (role === "worker") {
    return db
      .select({
        id: workOrders.id,
        title: workOrders.title,
        status: workOrders.status,
      })
      .from(workOrderAssignments)
      .innerJoin(workOrders, eq(workOrderAssignments.workOrderId, workOrders.id))
      .where(
        and(
          eq(workOrders.ranchId, ranchId),
          eq(workOrderAssignments.membershipId, membershipId),
          notInArray(workOrders.status, ["completed", "cancelled"]),
        ),
      );
  }

  return db
    .select({
      id: workOrders.id,
      title: workOrders.title,
      status: workOrders.status,
    })
    .from(workOrders)
    .where(
      and(
        eq(workOrders.ranchId, ranchId),
        notInArray(workOrders.status, ["completed", "cancelled"]),
      ),
    );
}

export async function getActiveShiftRosterForRanch(
  ranchId: string,
): Promise<ActiveShiftRosterItem[]> {
  const activeShifts = await db
    .select({
      membershipId: shifts.membershipId,
      memberName: users.fullName,
      role: ranchMemberships.role,
      shiftStartedAt: shifts.startedAt,
    })
    .from(shifts)
    .innerJoin(ranchMemberships, eq(shifts.membershipId, ranchMemberships.id))
    .innerJoin(users, eq(ranchMemberships.userId, users.id))
    .where(and(eq(shifts.ranchId, ranchId), isNull(shifts.endedAt)))
    .orderBy(desc(shifts.startedAt));

  if (!activeShifts.length) {
    return [];
  }

  const activeWorkRows = await db
    .select({
      membershipId: workTimeEntries.membershipId,
      title: workOrders.title,
    })
    .from(workTimeEntries)
    .innerJoin(workOrders, eq(workTimeEntries.workOrderId, workOrders.id))
    .where(
      and(
        eq(workTimeEntries.ranchId, ranchId),
        isNull(workTimeEntries.endedAt),
        inArray(
          workTimeEntries.membershipId,
          activeShifts.map((shift) => shift.membershipId),
        ),
      ),
    );

  const activeWorkMap = new Map<string, string>();
  for (const row of activeWorkRows) {
    activeWorkMap.set(row.membershipId, row.title);
  }

  return activeShifts.map((shift) => ({
    ...shift,
    activeWorkTitle: activeWorkMap.get(shift.membershipId) ?? null,
  }));
}
