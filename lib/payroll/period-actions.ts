"use server";

import { and, eq, gte, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/context";
import { db } from "@/lib/db/client";
import {
  payrollPeriodAdvances,
  payrollPeriodMemberReceipts,
  payrollPeriods,
  ranchMemberships,
} from "@/lib/db/schema";

export interface PayrollPeriodActionState {
  error?: string;
  success?: string;
}

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");

const createPeriodSchema = z
  .object({
    periodStart: dateOnlySchema,
    periodEnd: dateOnlySchema,
    payDate: dateOnlySchema,
  })
  .superRefine((value, ctx) => {
    if (value.periodEnd < value.periodStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["periodEnd"],
        message: "Period end must be on or after period start.",
      });
    }

    if (value.payDate < value.periodEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["payDate"],
        message: "Pay date must be on or after period end.",
      });
    }
  });

const createAdvanceSchema = z.object({
  periodId: z.string().uuid(),
  membershipId: z.string().uuid(),
  amount: z.coerce.number().gt(0, "Advance amount must be greater than zero."),
  note: z.string().trim().max(200, "Note must be 200 characters or fewer.").optional(),
});

const deletePeriodSchema = z.object({
  periodId: z.string().uuid(),
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

export async function createPayrollPeriodAction(
  _prevState: PayrollPeriodActionState,
  formData: FormData,
): Promise<PayrollPeriodActionState> {
  const context = await requireRole(["owner"]);
  const parsed = createPeriodSchema.safeParse({
    periodStart: formData.get("periodStart"),
    periodEnd: formData.get("periodEnd"),
    payDate: formData.get("payDate"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid pay period." };
  }

  const [overlap] = await db
    .select({
      id: payrollPeriods.id,
      periodStart: payrollPeriods.periodStart,
      periodEnd: payrollPeriods.periodEnd,
    })
    .from(payrollPeriods)
    .where(
      and(
        eq(payrollPeriods.ranchId, context.ranch.id),
        lte(payrollPeriods.periodStart, parsed.data.periodEnd),
        gte(payrollPeriods.periodEnd, parsed.data.periodStart),
      ),
    )
    .limit(1);

  if (overlap) {
    return {
      error: `This period overlaps ${overlap.periodStart} to ${overlap.periodEnd}.`,
    };
  }

  await db.insert(payrollPeriods).values({
    ranchId: context.ranch.id,
    periodStart: parsed.data.periodStart,
    periodEnd: parsed.data.periodEnd,
    payDate: parsed.data.payDate,
  });

  revalidatePath("/app/payroll");
  return { success: "Pay period created." };
}

export async function deletePayrollPeriodAction(formData: FormData): Promise<void> {
  const context = await requireRole(["owner"]);
  const parsed = deletePeriodSchema.safeParse({
    periodId: formData.get("periodId"),
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

  await db.delete(payrollPeriods).where(eq(payrollPeriods.id, period.id));
  revalidatePath("/app/payroll");
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

export async function setPayrollMemberCheckPickupAction(formData: FormData): Promise<void> {
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
