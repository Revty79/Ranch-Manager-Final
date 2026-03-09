"use server";

import { and, eq, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/context";
import { db } from "@/lib/db/client";
import { ranchMemberships, shifts, workTimeEntries } from "@/lib/db/schema";

const editEntrySchema = z.object({
  entryId: z.string().uuid(),
  startedAt: z.string().trim().min(1, "Clock-in time is required."),
  endedAt: z.string().trim().optional(),
});
const createShiftEntrySchema = z.object({
  membershipId: z.string().uuid(),
  startedAt: z.string().trim().min(1, "Clock-in time is required."),
  endedAt: z.string().trim().optional(),
});

function parseDateTime(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const localDateTimeMatch = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/,
  );

  if (localDateTimeMatch) {
    const year = Number(localDateTimeMatch[1]);
    const month = Number(localDateTimeMatch[2]);
    const day = Number(localDateTimeMatch[3]);
    const hour = Number(localDateTimeMatch[4]);
    const minute = Number(localDateTimeMatch[5]);
    const second = Number(localDateTimeMatch[6] ?? "0");

    if (
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31 ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59 ||
      second < 0 ||
      second > 59
    ) {
      return null;
    }

    const parsedLocalDate = new Date(year, month - 1, day, hour, minute, second, 0);
    if (Number.isNaN(parsedLocalDate.getTime())) {
      return null;
    }

    if (
      parsedLocalDate.getFullYear() !== year ||
      parsedLocalDate.getMonth() !== month - 1 ||
      parsedLocalDate.getDate() !== day ||
      parsedLocalDate.getHours() !== hour ||
      parsedLocalDate.getMinutes() !== minute
    ) {
      return null;
    }

    return parsedLocalDate;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function updateShiftEntryAction(
  _prevState: { error?: string; success?: string },
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const context = await requireRole(["owner", "manager"]);
  const parsed = editEntrySchema.safeParse({
    entryId: formData.get("entryId"),
    startedAt: formData.get("startedAt"),
    endedAt: formData.get("endedAt"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid shift time update." };
  }

  const startedAt = parseDateTime(parsed.data.startedAt);
  const endedAt = parseDateTime(parsed.data.endedAt);
  if (!startedAt) {
    return { error: "Enter a valid shift clock-in time (YYYY-MM-DD HH:mm)." };
  }

  if (endedAt && endedAt <= startedAt) {
    return { error: "Shift clock-out time must be after clock-in time." };
  }

  const [target] = await db
    .select({
      id: shifts.id,
      membershipId: shifts.membershipId,
    })
    .from(shifts)
    .where(and(eq(shifts.id, parsed.data.entryId), eq(shifts.ranchId, context.ranch.id)))
    .limit(1);

  if (!target) {
    return { error: "Shift entry not found for this ranch." };
  }

  if (!endedAt) {
    const [otherActiveShift] = await db
      .select({ id: shifts.id })
      .from(shifts)
      .where(
        and(
          eq(shifts.ranchId, context.ranch.id),
          eq(shifts.membershipId, target.membershipId),
          isNull(shifts.endedAt),
          ne(shifts.id, target.id),
        ),
      )
      .limit(1);

    if (otherActiveShift) {
      return { error: "This member already has another active shift." };
    }
  }

  await db
    .update(shifts)
    .set({
      startedAt,
      endedAt,
      pausedAt: null,
      pausedAccumulatedSeconds: 0,
    })
    .where(eq(shifts.id, target.id));

  revalidatePath("/app/time");
  revalidatePath("/app/payroll");
  revalidatePath("/app/team");
  revalidatePath(`/app/team/${target.membershipId}`);
  return { success: "Shift entry updated." };
}

export async function createShiftEntryAction(
  _prevState: { error?: string; success?: string },
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const context = await requireRole(["owner", "manager"]);
  const parsed = createShiftEntrySchema.safeParse({
    membershipId: formData.get("membershipId"),
    startedAt: formData.get("startedAt"),
    endedAt: formData.get("endedAt"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid manual shift entry." };
  }

  const startedAt = parseDateTime(parsed.data.startedAt);
  const endedAt = parseDateTime(parsed.data.endedAt);
  if (!startedAt) {
    return { error: "Enter a valid shift clock-in time (YYYY-MM-DD HH:mm)." };
  }

  if (endedAt && endedAt <= startedAt) {
    return { error: "Shift clock-out time must be after clock-in time." };
  }

  const [membership] = await db
    .select({ id: ranchMemberships.id })
    .from(ranchMemberships)
    .where(
      and(
        eq(ranchMemberships.ranchId, context.ranch.id),
        eq(ranchMemberships.id, parsed.data.membershipId),
      ),
    )
    .limit(1);

  if (!membership) {
    return { error: "Team member not found in this ranch." };
  }

  if (!endedAt) {
    const [otherActiveShift] = await db
      .select({ id: shifts.id })
      .from(shifts)
      .where(
        and(
          eq(shifts.ranchId, context.ranch.id),
          eq(shifts.membershipId, parsed.data.membershipId),
          isNull(shifts.endedAt),
        ),
      )
      .limit(1);

    if (otherActiveShift) {
      return { error: "This member already has an active shift." };
    }
  }

  await db.insert(shifts).values({
    ranchId: context.ranch.id,
    membershipId: parsed.data.membershipId,
    startedAt,
    endedAt,
    pausedAt: null,
    pausedAccumulatedSeconds: 0,
  });

  revalidatePath("/app/time");
  revalidatePath("/app/payroll");
  revalidatePath("/app/team");
  revalidatePath(`/app/team/${parsed.data.membershipId}`);
  return { success: "Manual shift entry created." };
}

export async function updateWorkEntryAction(
  _prevState: { error?: string; success?: string },
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const context = await requireRole(["owner", "manager"]);
  const parsed = editEntrySchema.safeParse({
    entryId: formData.get("entryId"),
    startedAt: formData.get("startedAt"),
    endedAt: formData.get("endedAt"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid work time update." };
  }

  const startedAt = parseDateTime(parsed.data.startedAt);
  const endedAt = parseDateTime(parsed.data.endedAt);
  if (!startedAt) {
    return { error: "Enter a valid work timer start time (YYYY-MM-DD HH:mm)." };
  }

  if (endedAt && endedAt <= startedAt) {
    return { error: "Work timer stop time must be after start time." };
  }

  const [target] = await db
    .select({
      id: workTimeEntries.id,
      membershipId: workTimeEntries.membershipId,
    })
    .from(workTimeEntries)
    .where(
      and(
        eq(workTimeEntries.id, parsed.data.entryId),
        eq(workTimeEntries.ranchId, context.ranch.id),
      ),
    )
    .limit(1);

  if (!target) {
    return { error: "Work timer entry not found for this ranch." };
  }

  if (!endedAt) {
    const [otherActiveEntry] = await db
      .select({ id: workTimeEntries.id })
      .from(workTimeEntries)
      .where(
        and(
          eq(workTimeEntries.ranchId, context.ranch.id),
          eq(workTimeEntries.membershipId, target.membershipId),
          isNull(workTimeEntries.endedAt),
          ne(workTimeEntries.id, target.id),
        ),
      )
      .limit(1);

    if (otherActiveEntry) {
      return { error: "This member already has another active work timer." };
    }
  }

  await db
    .update(workTimeEntries)
    .set({
      startedAt,
      endedAt,
    })
    .where(eq(workTimeEntries.id, target.id));

  revalidatePath("/app/time");
  revalidatePath("/app/payroll");
  revalidatePath("/app/work-orders");
  revalidatePath("/app/team");
  revalidatePath(`/app/team/${target.membershipId}`);
  return { success: "Work timer entry updated." };
}
