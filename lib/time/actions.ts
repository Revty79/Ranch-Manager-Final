"use server";

import { and, eq, isNull, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAppContext } from "@/lib/auth/context";
import { db } from "@/lib/db/client";
import {
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

const initialState: TimeActionState = {};
export const defaultTimeActionState = initialState;

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

  await db.insert(shifts).values({
    ranchId: context.ranch.id,
    membershipId: context.membership.id,
  });

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
        endedAt: endTime,
      })
      .where(eq(shifts.id, activeShift.id));
  });

  revalidatePath("/app/time");
  return { success: "Shift ended." };
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
  if (!activeShift) {
    return { error: "Start a shift before clocking into work." };
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

  if (context.membership.role === "worker") {
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

  await db.transaction(async (tx) => {
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

  revalidatePath("/app/time");
  return { success: "Work timer started." };
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
