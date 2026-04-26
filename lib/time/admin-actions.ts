"use server";

import { and, eq, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isPlatformAdminEmail } from "@/lib/auth/platform-admin";
import { requireRole } from "@/lib/auth/context";
import { parseDateTimeInputInTimeZone } from "@/lib/date-time-local";
import { db } from "@/lib/db/client";
import { ranchMemberships, shifts, users, workTimeEntries } from "@/lib/db/schema";

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
const deleteEntrySchema = z.object({
  entryId: z.string().uuid(),
});

function parseDateTime(value: string | undefined, timeZone: string): Date | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const parsedInTimeZone = parseDateTimeInputInTimeZone(trimmed, timeZone);
  if (parsedInTimeZone) {
    return parsedInTimeZone;
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

  const startedAt = parseDateTime(parsed.data.startedAt, context.user.timeZone);
  const endedAt = parseDateTime(parsed.data.endedAt, context.user.timeZone);
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

  const [targetMembership] = await db
    .select({ email: users.email })
    .from(ranchMemberships)
    .innerJoin(users, eq(ranchMemberships.userId, users.id))
    .where(
      and(
        eq(ranchMemberships.ranchId, context.ranch.id),
        eq(ranchMemberships.id, target.membershipId),
      ),
    )
    .limit(1);

  if (!targetMembership || isPlatformAdminEmail(targetMembership.email)) {
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

  const startedAt = parseDateTime(parsed.data.startedAt, context.user.timeZone);
  const endedAt = parseDateTime(parsed.data.endedAt, context.user.timeZone);
  if (!startedAt) {
    return { error: "Enter a valid shift clock-in time (YYYY-MM-DD HH:mm)." };
  }

  if (endedAt && endedAt <= startedAt) {
    return { error: "Shift clock-out time must be after clock-in time." };
  }

  const [membership] = await db
    .select({
      id: ranchMemberships.id,
      email: users.email,
    })
    .from(ranchMemberships)
    .innerJoin(users, eq(ranchMemberships.userId, users.id))
    .where(
      and(
        eq(ranchMemberships.ranchId, context.ranch.id),
        eq(ranchMemberships.id, parsed.data.membershipId),
      ),
    )
    .limit(1);

  if (!membership || isPlatformAdminEmail(membership.email)) {
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

  const startedAt = parseDateTime(parsed.data.startedAt, context.user.timeZone);
  const endedAt = parseDateTime(parsed.data.endedAt, context.user.timeZone);
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

  const [targetMembership] = await db
    .select({ email: users.email })
    .from(ranchMemberships)
    .innerJoin(users, eq(ranchMemberships.userId, users.id))
    .where(
      and(
        eq(ranchMemberships.ranchId, context.ranch.id),
        eq(ranchMemberships.id, target.membershipId),
      ),
    )
    .limit(1);

  if (!targetMembership || isPlatformAdminEmail(targetMembership.email)) {
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

export async function deleteShiftEntryAction(
  _prevState: { error?: string; success?: string },
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const context = await requireRole(["owner", "manager"]);
  const parsed = deleteEntrySchema.safeParse({
    entryId: formData.get("entryId"),
  });

  if (!parsed.success) {
    return { error: "Invalid shift delete request." };
  }

  const [target] = await db
    .select({
      id: shifts.id,
      membershipId: shifts.membershipId,
      endedAt: shifts.endedAt,
    })
    .from(shifts)
    .where(and(eq(shifts.id, parsed.data.entryId), eq(shifts.ranchId, context.ranch.id)))
    .limit(1);

  if (!target) {
    return { error: "Shift entry not found for this ranch." };
  }

  const [targetMembership] = await db
    .select({ email: users.email })
    .from(ranchMemberships)
    .innerJoin(users, eq(ranchMemberships.userId, users.id))
    .where(
      and(
        eq(ranchMemberships.ranchId, context.ranch.id),
        eq(ranchMemberships.id, target.membershipId),
      ),
    )
    .limit(1);

  if (!targetMembership || isPlatformAdminEmail(targetMembership.email)) {
    return { error: "Shift entry not found for this ranch." };
  }

  if (!target.endedAt) {
    return {
      error: "Active shift entries cannot be deleted. Clock out first, then delete.",
    };
  }

  await db.delete(shifts).where(eq(shifts.id, target.id));

  revalidatePath("/app/time");
  revalidatePath("/app/payroll");
  revalidatePath("/app/team");
  revalidatePath(`/app/team/${target.membershipId}`);
  return { success: "Shift entry deleted." };
}

export async function deleteWorkEntryAction(
  _prevState: { error?: string; success?: string },
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const context = await requireRole(["owner", "manager"]);
  const parsed = deleteEntrySchema.safeParse({
    entryId: formData.get("entryId"),
  });

  if (!parsed.success) {
    return { error: "Invalid work timer delete request." };
  }

  const [target] = await db
    .select({
      id: workTimeEntries.id,
      membershipId: workTimeEntries.membershipId,
      endedAt: workTimeEntries.endedAt,
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

  const [targetMembership] = await db
    .select({ email: users.email })
    .from(ranchMemberships)
    .innerJoin(users, eq(ranchMemberships.userId, users.id))
    .where(
      and(
        eq(ranchMemberships.ranchId, context.ranch.id),
        eq(ranchMemberships.id, target.membershipId),
      ),
    )
    .limit(1);

  if (!targetMembership || isPlatformAdminEmail(targetMembership.email)) {
    return { error: "Work timer entry not found for this ranch." };
  }

  if (!target.endedAt) {
    return {
      error: "Active work timer entries cannot be deleted. Stop the timer first, then delete.",
    };
  }

  await db.delete(workTimeEntries).where(eq(workTimeEntries.id, target.id));

  revalidatePath("/app/time");
  revalidatePath("/app/payroll");
  revalidatePath("/app/work-orders");
  revalidatePath("/app/team");
  revalidatePath(`/app/team/${target.membershipId}`);
  return { success: "Work timer entry deleted." };
}
