"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/context";
import { db } from "@/lib/db/client";
import {
  payrollPeriodAdvances,
  payrollPeriodMemberReceipts,
  payrollPeriods,
  payrollSettings,
  ranchMemberships,
} from "@/lib/db/schema";
import { ensurePayrollPeriodsForRanch } from "@/lib/payroll/period-queries";

export interface PayrollPeriodActionState {
  error?: string;
  success?: string;
}

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");

const settingsSchema = z.object({
  anchorStartDate: dateOnlySchema,
  periodLengthDays: z.coerce
    .number()
    .int("Period length must be a whole number.")
    .min(7, "Period length must be at least 7 days.")
    .max(31, "Period length must be 31 days or fewer."),
  paydayOffsetDays: z.coerce
    .number()
    .int("Payday offset must be a whole number.")
    .min(0, "Payday offset cannot be negative.")
    .max(31, "Payday offset must be 31 days or fewer."),
});

const createAdvanceSchema = z.object({
  periodId: z.string().uuid(),
  membershipId: z.string().uuid(),
  amount: z.coerce.number().gt(0, "Advance amount must be greater than zero."),
  note: z.string().trim().max(200, "Note must be 200 characters or fewer.").optional(),
});

const periodPaidStateSchema = z.object({
  periodId: z.string().uuid(),
  setPaid: z.enum(["true", "false"]),
});

const checkPickupSchema = z.object({
  periodId: z.string().uuid(),
  membershipId: z.string().uuid(),
  setPicked: z.enum(["true", "false"]),
});

function toCents(value: number): number {
  return Math.round(value * 100);
}

export async function updatePayrollSettingsAction(
  _prevState: PayrollPeriodActionState,
  formData: FormData,
): Promise<PayrollPeriodActionState> {
  const context = await requireRole(["owner"]);
  const parsed = settingsSchema.safeParse({
    anchorStartDate: formData.get("anchorStartDate"),
    periodLengthDays: formData.get("periodLengthDays"),
    paydayOffsetDays: formData.get("paydayOffsetDays"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid payroll settings." };
  }

  const [existing] = await db
    .select({ ranchId: payrollSettings.ranchId })
    .from(payrollSettings)
    .where(eq(payrollSettings.ranchId, context.ranch.id))
    .limit(1);

  if (existing) {
    await db
      .update(payrollSettings)
      .set({
        anchorStartDate: parsed.data.anchorStartDate,
        periodLengthDays: parsed.data.periodLengthDays,
        paydayOffsetDays: parsed.data.paydayOffsetDays,
        updatedAt: new Date(),
      })
      .where(eq(payrollSettings.ranchId, context.ranch.id));
  } else {
    await db.insert(payrollSettings).values({
      ranchId: context.ranch.id,
      anchorStartDate: parsed.data.anchorStartDate,
      periodLengthDays: parsed.data.periodLengthDays,
      paydayOffsetDays: parsed.data.paydayOffsetDays,
    });
  }

  await ensurePayrollPeriodsForRanch(context.ranch.id, {
    ranchId: context.ranch.id,
    anchorStartDate: parsed.data.anchorStartDate,
    periodLengthDays: parsed.data.periodLengthDays,
    paydayOffsetDays: parsed.data.paydayOffsetDays,
  });

  revalidatePath("/app/payroll");
  return { success: "Payroll schedule updated." };
}

export async function addPayrollAdvanceAction(
  _prevState: PayrollPeriodActionState,
  formData: FormData,
): Promise<PayrollPeriodActionState> {
  const context = await requireRole(["owner"]);
  const parsed = createAdvanceSchema.safeParse({
    periodId: formData.get("periodId"),
    membershipId: formData.get("membershipId"),
    amount: formData.get("amount"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid payroll advance." };
  }

  const [period] = await db
    .select({ id: payrollPeriods.id })
    .from(payrollPeriods)
    .where(
      and(
        eq(payrollPeriods.ranchId, context.ranch.id),
        eq(payrollPeriods.id, parsed.data.periodId),
      ),
    )
    .limit(1);

  if (!period) {
    return { error: "Selected pay period was not found." };
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
    return { error: "Selected team member was not found." };
  }

  await db.insert(payrollPeriodAdvances).values({
    ranchId: context.ranch.id,
    periodId: parsed.data.periodId,
    membershipId: parsed.data.membershipId,
    amountCents: toCents(parsed.data.amount),
    note: parsed.data.note?.trim() ? parsed.data.note.trim() : null,
    createdByMembershipId: context.membership.id,
  });

  revalidatePath("/app/payroll");
  return { success: "Payroll advance added to period." };
}

export async function setPayrollPeriodPaidStateAction(formData: FormData): Promise<void> {
  const context = await requireRole(["owner"]);
  const parsed = periodPaidStateSchema.safeParse({
    periodId: formData.get("periodId"),
    setPaid: formData.get("setPaid"),
  });

  if (!parsed.success) {
    return;
  }

  const [period] = await db
    .select({ id: payrollPeriods.id })
    .from(payrollPeriods)
    .where(
      and(
        eq(payrollPeriods.ranchId, context.ranch.id),
        eq(payrollPeriods.id, parsed.data.periodId),
      ),
    )
    .limit(1);

  if (!period) {
    return;
  }

  const setPaid = parsed.data.setPaid === "true";
  await db
    .update(payrollPeriods)
    .set({
      status: setPaid ? "paid" : "open",
      paidAt: setPaid ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(payrollPeriods.id, period.id));

  revalidatePath("/app/payroll");
}

export async function setPayrollMemberCheckPickupAction(
  formData: FormData,
): Promise<void> {
  const context = await requireRole(["owner"]);
  const parsed = checkPickupSchema.safeParse({
    periodId: formData.get("periodId"),
    membershipId: formData.get("membershipId"),
    setPicked: formData.get("setPicked"),
  });

  if (!parsed.success) {
    return;
  }

  const [period] = await db
    .select({ id: payrollPeriods.id, status: payrollPeriods.status })
    .from(payrollPeriods)
    .where(
      and(
        eq(payrollPeriods.ranchId, context.ranch.id),
        eq(payrollPeriods.id, parsed.data.periodId),
      ),
    )
    .limit(1);

  if (!period || period.status !== "paid") {
    return;
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
    return;
  }

  const setPicked = parsed.data.setPicked === "true";
  const [existing] = await db
    .select({ id: payrollPeriodMemberReceipts.id })
    .from(payrollPeriodMemberReceipts)
    .where(
      and(
        eq(payrollPeriodMemberReceipts.ranchId, context.ranch.id),
        eq(payrollPeriodMemberReceipts.periodId, parsed.data.periodId),
        eq(payrollPeriodMemberReceipts.membershipId, parsed.data.membershipId),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(payrollPeriodMemberReceipts)
      .set({
        isCheckPickedUp: setPicked,
        pickedUpAt: setPicked ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(payrollPeriodMemberReceipts.id, existing.id));
  } else {
    await db.insert(payrollPeriodMemberReceipts).values({
      ranchId: context.ranch.id,
      periodId: parsed.data.periodId,
      membershipId: parsed.data.membershipId,
      isCheckPickedUp: setPicked,
      pickedUpAt: setPicked ? new Date() : null,
    });
  }

  revalidatePath("/app/payroll");
}
