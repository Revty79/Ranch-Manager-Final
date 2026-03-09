"use server";

import { and, eq, isNull, notInArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAppContext } from "@/lib/auth/context";
import { db } from "@/lib/db/client";
import {
  ranchMemberships,
  workOrderAssignments,
  workOrders,
  workTimeEntries,
  shifts,
} from "@/lib/db/schema";
import {
  getActiveShiftForMembership,
  getActiveWorkSessionForMembership,
} from "./queries";

export interface TimeActionState {
  error?: string;
  success?: string;
}

const startWorkSchema = z.object({
  workOrderId: z.string().uuid(),
});
const completeWorkOrderSchema = z.object({
  workOrderId: z.string().uuid(),
});
const ACTIVE_SHIFT_RACE = Symbol("ACTIVE_SHIFT_RACE");
const ACTIVE_WORK_RACE = Symbol("ACTIVE_WORK_RACE");

function elapsedSeconds(start: Date, end: Date): number {
  return Math.max(Math.floor((end.getTime() - start.getTime()) / 1000), 0);
}

export async function startShiftAction(
  _prevState: TimeActionState,
  _formData: FormData,
): Promise<TimeActionState> {
  void _prevState;
  void _formData;
  const context = await requireAppContext();
  const activeShift = await getActiveShiftForMembership(
    context.ranch.id,
    context.membership.id,
  );

  if (activeShift) {
    return { error: "You already have an active shift." };
  }

  if (context.membership.payType === "piece_work") {
    return {
      error:
        "Piece-work members should clock directly into work orders. Shift clock-in is disabled to prevent double pay.",
    };
  }

  try {
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`select ${ranchMemberships.id} from ${ranchMemberships} where ${ranchMemberships.id} = ${context.membership.id} for update`,
      );

      const [lockedActiveShift] = await tx
        .select({ id: shifts.id })
        .from(shifts)
        .where(
          and(
            eq(shifts.ranchId, context.ranch.id),
            eq(shifts.membershipId, context.membership.id),
            isNull(shifts.endedAt),
          ),
        )
        .limit(1);

      if (lockedActiveShift) {
        throw ACTIVE_SHIFT_RACE;
      }

      await tx.insert(shifts).values({
        ranchId: context.ranch.id,
        membershipId: context.membership.id,
      });
    });
  } catch (error) {
    if (error === ACTIVE_SHIFT_RACE) {
      return { error: "You already have an active shift." };
    }

    throw error;
  }

  revalidatePath("/app/time");
  return { success: "Shift started." };
}

export async function endShiftAction(
  _prevState: TimeActionState,
  _formData: FormData,
): Promise<TimeActionState> {
  void _prevState;
  void _formData;
  const context = await requireAppContext();
  const activeShift = await getActiveShiftForMembership(
    context.ranch.id,
    context.membership.id,
  );

  if (!activeShift) {
    return { error: "No active shift to end." };
  }

  const activeWork = await getActiveWorkSessionForMembership(
    context.ranch.id,
    context.membership.id,
  );
  const endTime = new Date();
  const additionalPausedSeconds = activeShift.pausedAt
    ? elapsedSeconds(activeShift.pausedAt, endTime)
    : 0;

  await db.transaction(async (tx) => {
    if (activeWork) {
      await tx
        .update(workTimeEntries)
        .set({
          endedAt: endTime,
        })
        .where(eq(workTimeEntries.id, activeWork.id));
    }

    await tx
      .update(shifts)
      .set({
        pausedAt: null,
        pausedAccumulatedSeconds:
          activeShift.pausedAccumulatedSeconds + additionalPausedSeconds,
        endedAt: endTime,
      })
      .where(eq(shifts.id, activeShift.id));
  });

  revalidatePath("/app/time");
  return { success: "Shift ended." };
}

export async function pauseShiftAction(
  _prevState: TimeActionState,
  _formData: FormData,
): Promise<TimeActionState> {
  void _prevState;
  void _formData;
  const context = await requireAppContext();
  const activeShift = await getActiveShiftForMembership(
    context.ranch.id,
    context.membership.id,
  );

  if (!activeShift) {
    return { error: "Start a shift before pausing." };
  }

  if (activeShift.pausedAt) {
    return { error: "Shift is already paused." };
  }

  const activeWork = await getActiveWorkSessionForMembership(
    context.ranch.id,
    context.membership.id,
  );
  const pausedAt = new Date();

  await db.transaction(async (tx) => {
    if (activeWork) {
      await tx
        .update(workTimeEntries)
        .set({
          endedAt: pausedAt,
        })
        .where(eq(workTimeEntries.id, activeWork.id));
    }

    await tx
      .update(shifts)
      .set({
        pausedAt,
      })
      .where(eq(shifts.id, activeShift.id));
  });

  revalidatePath("/app/time");
  return { success: "Shift paused." };
}

export async function resumeShiftAction(
  _prevState: TimeActionState,
  _formData: FormData,
): Promise<TimeActionState> {
  void _prevState;
  void _formData;
  const context = await requireAppContext();
  const activeShift = await getActiveShiftForMembership(
    context.ranch.id,
    context.membership.id,
  );

  if (!activeShift) {
    return { error: "No active shift to resume." };
  }

  if (!activeShift.pausedAt) {
    return { error: "Shift is not paused." };
  }

  const resumeTime = new Date();
  const additionalPausedSeconds = elapsedSeconds(activeShift.pausedAt, resumeTime);

  await db
    .update(shifts)
    .set({
      pausedAt: null,
      pausedAccumulatedSeconds:
        activeShift.pausedAccumulatedSeconds + additionalPausedSeconds,
    })
    .where(eq(shifts.id, activeShift.id));

  revalidatePath("/app/time");
  return { success: "Shift resumed." };
}

export async function startWorkSessionAction(
  _prevState: TimeActionState,
  formData: FormData,
): Promise<TimeActionState> {
  const context = await requireAppContext();
  const parsed = startWorkSchema.safeParse({
    workOrderId: formData.get("workOrderId"),
  });

  if (!parsed.success) {
    return { error: "Select a valid work order." };
  }

  const activeShift = await getActiveShiftForMembership(
    context.ranch.id,
    context.membership.id,
  );

  const isPieceWorkMember = context.membership.payType === "piece_work";
  if (isPieceWorkMember && activeShift) {
    return {
      error:
        "Clock out of your shift before starting piece-work tracking on a work order.",
    };
  }

  if (!isPieceWorkMember) {
    if (!activeShift) {
      return { error: "Start a shift before clocking into work." };
    }

    if (activeShift.pausedAt) {
      return { error: "Resume your shift before starting work timer." };
    }
  }

  const activeWork = await getActiveWorkSessionForMembership(
    context.ranch.id,
    context.membership.id,
  );
  if (activeWork) {
    return { error: "End your current work item before starting another." };
  }

  const [workOrder] = await db
    .select({
      id: workOrders.id,
      status: workOrders.status,
    })
    .from(workOrders)
    .where(
      and(
        eq(workOrders.id, parsed.data.workOrderId),
        eq(workOrders.ranchId, context.ranch.id),
        notInArray(workOrders.status, ["completed", "cancelled"]),
      ),
    )
    .limit(1);

  if (!workOrder) {
    return { error: "Work order is unavailable for time tracking." };
  }

  if (
    context.membership.role === "worker" ||
    context.membership.role === "seasonal_worker"
  ) {
    const [assignment] = await db
      .select({ id: workOrderAssignments.id })
      .from(workOrderAssignments)
      .where(
        and(
          eq(workOrderAssignments.workOrderId, parsed.data.workOrderId),
          eq(workOrderAssignments.membershipId, context.membership.id),
        ),
      )
      .limit(1);

    if (!assignment) {
      return { error: "Workers can only track time on assigned work orders." };
    }
  }

  try {
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`select ${ranchMemberships.id} from ${ranchMemberships} where ${ranchMemberships.id} = ${context.membership.id} for update`,
      );

      const [lockedActiveWork] = await tx
        .select({ id: workTimeEntries.id })
        .from(workTimeEntries)
        .where(
          and(
            eq(workTimeEntries.ranchId, context.ranch.id),
            eq(workTimeEntries.membershipId, context.membership.id),
            isNull(workTimeEntries.endedAt),
          ),
        )
        .limit(1);

      if (lockedActiveWork) {
        throw ACTIVE_WORK_RACE;
      }

      await tx.insert(workTimeEntries).values({
        ranchId: context.ranch.id,
        membershipId: context.membership.id,
        workOrderId: parsed.data.workOrderId,
      });

      if (workOrder.status === "draft" || workOrder.status === "open") {
        await tx
          .update(workOrders)
          .set({
            status: "in_progress",
            updatedAt: new Date(),
          })
          .where(eq(workOrders.id, parsed.data.workOrderId));
      }
    });
  } catch (error) {
    if (error === ACTIVE_WORK_RACE) {
      return { error: "End your current work item before starting another." };
    }

    throw error;
  }

  revalidatePath("/app/time");
  return { success: "Work timer started." };
}

export async function completeWorkOrderAction(
  _prevState: TimeActionState,
  formData: FormData,
): Promise<TimeActionState> {
  const context = await requireAppContext();
  const parsed = completeWorkOrderSchema.safeParse({
    workOrderId: formData.get("workOrderId"),
  });

  if (!parsed.success) {
    return { error: "Select a valid work order to complete." };
  }

  const [workOrder] = await db
    .select({
      id: workOrders.id,
      status: workOrders.status,
    })
    .from(workOrders)
    .where(
      and(
        eq(workOrders.id, parsed.data.workOrderId),
        eq(workOrders.ranchId, context.ranch.id),
      ),
    )
    .limit(1);

  if (!workOrder) {
    return { error: "Work order not found for this ranch." };
  }

  if (workOrder.status === "cancelled") {
    return { error: "Cancelled work orders cannot be completed." };
  }

  if (
    context.membership.role === "worker" ||
    context.membership.role === "seasonal_worker"
  ) {
    const [assignment] = await db
      .select({ id: workOrderAssignments.id })
      .from(workOrderAssignments)
      .where(
        and(
          eq(workOrderAssignments.workOrderId, parsed.data.workOrderId),
          eq(workOrderAssignments.membershipId, context.membership.id),
        ),
      )
      .limit(1);

    if (!assignment) {
      return { error: "Workers can only complete assigned work orders." };
    }
  }

  const activeWork = await getActiveWorkSessionForMembership(
    context.ranch.id,
    context.membership.id,
  );

  if (activeWork && activeWork.workOrderId !== parsed.data.workOrderId) {
    return {
      error:
        "Stop your current work timer before completing a different work order.",
    };
  }

  const completionTime = new Date();
  await db.transaction(async (tx) => {
    if (activeWork && activeWork.workOrderId === parsed.data.workOrderId) {
      await tx
        .update(workTimeEntries)
        .set({
          endedAt: completionTime,
        })
        .where(eq(workTimeEntries.id, activeWork.id));
    }

    await tx
      .update(workOrders)
      .set({
        status: "completed",
        completedAt: completionTime,
        updatedAt: completionTime,
      })
      .where(eq(workOrders.id, parsed.data.workOrderId));
  });

  revalidatePath("/app/time");
  revalidatePath("/app/work-orders");
  revalidatePath(`/app/work-orders/${parsed.data.workOrderId}`);
  revalidatePath("/app/payroll");
  return { success: "Work order marked completed." };
}

export async function endWorkSessionAction(
  _prevState: TimeActionState,
  _formData: FormData,
): Promise<TimeActionState> {
  void _prevState;
  void _formData;
  const context = await requireAppContext();
  const activeWork = await getActiveWorkSessionForMembership(
    context.ranch.id,
    context.membership.id,
  );

  if (!activeWork) {
    return { error: "No active work timer to stop." };
  }

  await db
    .update(workTimeEntries)
    .set({
      endedAt: new Date(),
    })
    .where(
      and(
        eq(workTimeEntries.id, activeWork.id),
        eq(workTimeEntries.ranchId, context.ranch.id),
        eq(workTimeEntries.membershipId, context.membership.id),
        isNull(workTimeEntries.endedAt),
      ),
    );

  revalidatePath("/app/time");
  return { success: "Work timer stopped." };
}
