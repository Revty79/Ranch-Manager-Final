"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isPlatformAdminEmail } from "@/lib/auth/platform-admin";
import { requireRole } from "@/lib/auth/context";
import { db } from "@/lib/db/client";
import {
  ranchMemberships,
  users,
  workOrderCompletionReviews,
  type WorkOrderCompensationType,
  type WorkOrderIncentiveTimerType,
  workOrderAssignments,
  workOrders,
} from "@/lib/db/schema";

export interface WorkOrderActionState {
  error?: string;
  success?: string;
}

const statusSchema = z.enum([
  "draft",
  "open",
  "in_progress",
  "completed",
  "cancelled",
]);
const prioritySchema = z.enum(["low", "normal", "high"]);
const compensationTypeSchema = z.enum(["standard", "flat_amount"]);
const incentiveTimerTypeSchema = z.enum(["none", "hours", "deadline"]);
const maxIncentiveDurationHours = 24 * 365;

const optionalIncentiveHoursSchema = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z
    .coerce
    .number()
    .int("Incentive timer hours must be a whole number.")
    .min(1, "Incentive timer hours must be at least 1.")
    .max(
      maxIncentiveDurationHours,
      `Incentive timer hours must be ${maxIncentiveDurationHours} or less.`,
    )
    .optional(),
);

const workOrderSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters."),
  description: z.string().trim().optional(),
  status: statusSchema,
  priority: prioritySchema,
  dueAt: z.string().trim().optional(),
  compensationType: compensationTypeSchema.default("standard"),
  flatPay: z.coerce.number().min(0, "Flat pay must be zero or greater."),
  incentivePay: z.coerce.number().min(0, "Incentive pay must be zero or greater."),
  incentiveTimerType: incentiveTimerTypeSchema.default("none"),
  incentiveHours: optionalIncentiveHoursSchema,
  incentiveDeadlineAt: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.string().trim().optional(),
  ),
})
  .superRefine((value, ctx) => {
    const flatPayCents = toCents(value.flatPay);
    const incentivePayCents = toCents(value.incentivePay);

    if (value.compensationType === "flat_amount" && flatPayCents <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["flatPay"],
        message: "Enter a flat amount greater than zero.",
      });
    }

    if (value.compensationType === "standard" && flatPayCents > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["compensationType"],
        message: "Switch to flat amount pay to use a flat work-order payout.",
      });
    }

    if (incentivePayCents > 0 && value.incentiveTimerType === "none") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["incentiveTimerType"],
        message: "Select an incentive timer when incentive pay is set.",
      });
    }

    if (value.incentiveTimerType === "hours" && value.incentiveHours == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["incentiveHours"],
        message: "Enter incentive timer hours.",
      });
    }

    if (value.incentiveTimerType === "deadline") {
      const deadline = parseDateTime(value.incentiveDeadlineAt);
      if (!deadline) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["incentiveDeadlineAt"],
          message: "Enter a valid incentive deadline.",
        });
        return;
      }
    }
  });

const updateWorkOrderSchema = workOrderSchema.extend({
  workOrderId: z.string().uuid(),
});
const reviewDecisionSchema = z.enum(["approve", "send_back"]);
const reviewChecklistSchema = z.object({
  workOrderId: z.string().uuid(),
  decision: reviewDecisionSchema,
  checklistCompletionVerified: z.boolean(),
  checklistQualityVerified: z.boolean(),
  checklistCleanupVerified: z.boolean(),
  checklistFollowUpVerified: z.boolean(),
  managerNotes: z.string().trim().max(500, "Manager notes must be 500 characters or fewer.").optional(),
});

function parseDateTime(value?: string): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toCents(value: number): number {
  return Math.round(value * 100);
}

function resolveCompensationValues(data: z.infer<typeof workOrderSchema>): {
  compensationType: WorkOrderCompensationType;
  flatPayCents: number;
} {
  if (data.compensationType !== "flat_amount") {
    return {
      compensationType: "standard",
      flatPayCents: 0,
    };
  }

  return {
    compensationType: "flat_amount",
    flatPayCents: toCents(data.flatPay),
  };
}

function resolveIncentiveValues(data: z.infer<typeof workOrderSchema>): {
  incentivePayCents: number;
  incentiveTimerType: WorkOrderIncentiveTimerType;
  incentiveDurationHours: number | null;
  incentiveEndsAt: Date | null;
} {
  const incentivePayCents = toCents(data.incentivePay);
  if (incentivePayCents <= 0 || data.incentiveTimerType === "none") {
    return {
      incentivePayCents: 0,
      incentiveTimerType: "none",
      incentiveDurationHours: null,
      incentiveEndsAt: null,
    };
  }

  if (data.incentiveTimerType === "hours") {
    const hours = data.incentiveHours ?? 0;
    return {
      incentivePayCents,
      incentiveTimerType: "hours",
      incentiveDurationHours: hours,
      incentiveEndsAt: new Date(Date.now() + hours * 60 * 60 * 1000),
    };
  }

  return {
    incentivePayCents,
    incentiveTimerType: "deadline",
    incentiveDurationHours: null,
    incentiveEndsAt: parseDateTime(data.incentiveDeadlineAt),
  };
}

function parseAssigneeIds(formData: FormData): string[] {
  return [...new Set(formData.getAll("assigneeIds").map((id) => String(id)).filter(Boolean))];
}

function parseCheckbox(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
}

async function validateAssigneesForRanch(
  ranchId: string,
  assigneeIds: string[],
): Promise<string[] | null> {
  if (!assigneeIds.length) {
    return [];
  }

  const parsed = z.array(z.string().uuid()).safeParse(assigneeIds);
  if (!parsed.success) {
    return null;
  }

  const rows = await db
    .select({
      membershipId: ranchMemberships.id,
      email: users.email,
    })
    .from(ranchMemberships)
    .innerJoin(users, eq(ranchMemberships.userId, users.id))
    .where(
      and(
        eq(ranchMemberships.ranchId, ranchId),
        eq(ranchMemberships.isActive, true),
        inArray(ranchMemberships.id, parsed.data),
      ),
    );

  return rows
    .filter((row) => !isPlatformAdminEmail(row.email))
    .map((row) => row.membershipId);
}

async function replaceAssignments(workOrderId: string, assigneeIds: string[]) {
  await db.delete(workOrderAssignments).where(eq(workOrderAssignments.workOrderId, workOrderId));

  if (!assigneeIds.length) {
    return;
  }

  await db.insert(workOrderAssignments).values(
    assigneeIds.map((membershipId) => ({
      workOrderId,
      membershipId,
    })),
  );
}

export async function createWorkOrderAction(
  _prevState: WorkOrderActionState,
  formData: FormData,
): Promise<WorkOrderActionState> {
  const context = await requireRole(["owner", "manager"]);
  const parsed = workOrderSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    status: formData.get("status"),
    priority: formData.get("priority"),
    dueAt: formData.get("dueAt"),
    compensationType: formData.get("compensationType"),
    flatPay: formData.get("flatPay"),
    incentivePay: formData.get("incentivePay"),
    incentiveTimerType: formData.get("incentiveTimerType"),
    incentiveHours: formData.get("incentiveHours"),
    incentiveDeadlineAt: formData.get("incentiveDeadlineAt"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid work-order details." };
  }

  const assigneeIds = parseAssigneeIds(formData);
  const validAssigneeIds = await validateAssigneesForRanch(context.ranch.id, assigneeIds);
  if (!validAssigneeIds) {
    return { error: "Invalid assignee selection." };
  }

  if (parsed.data.compensationType === "flat_amount" && validAssigneeIds.length === 0) {
    return { error: "Flat-amount work orders must be assigned to at least one team member." };
  }

  const compensationValues = resolveCompensationValues(parsed.data);
  const incentiveValues = resolveIncentiveValues(parsed.data);

  const [newWorkOrder] = await db
    .insert(workOrders)
    .values({
      ranchId: context.ranch.id,
      title: parsed.data.title,
      description: parsed.data.description || null,
      status: parsed.data.status,
      priority: parsed.data.priority,
      dueAt: parseDateTime(parsed.data.dueAt),
      completedAt: parsed.data.status === "completed" ? new Date() : null,
      compensationType: compensationValues.compensationType,
      flatPayCents: compensationValues.flatPayCents,
      incentivePayCents: incentiveValues.incentivePayCents,
      incentiveTimerType: incentiveValues.incentiveTimerType,
      incentiveDurationHours: incentiveValues.incentiveDurationHours,
      incentiveEndsAt: incentiveValues.incentiveEndsAt,
      createdByMembershipId: context.membership.id,
    })
    .returning({ id: workOrders.id });

  await replaceAssignments(newWorkOrder.id, validAssigneeIds);

  revalidatePath("/app/work-orders");
  revalidatePath("/app/time");
  return { success: "Work order created." };
}

export async function updateWorkOrderAction(
  _prevState: WorkOrderActionState,
  formData: FormData,
): Promise<WorkOrderActionState> {
  const context = await requireRole(["owner", "manager"]);
  const parsed = updateWorkOrderSchema.safeParse({
    workOrderId: formData.get("workOrderId"),
    title: formData.get("title"),
    description: formData.get("description"),
    status: formData.get("status"),
    priority: formData.get("priority"),
    dueAt: formData.get("dueAt"),
    compensationType: formData.get("compensationType"),
    flatPay: formData.get("flatPay"),
    incentivePay: formData.get("incentivePay"),
    incentiveTimerType: formData.get("incentiveTimerType"),
    incentiveHours: formData.get("incentiveHours"),
    incentiveDeadlineAt: formData.get("incentiveDeadlineAt"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid work-order update." };
  }

  const [existing] = await db
    .select({
      id: workOrders.id,
      status: workOrders.status,
      completedAt: workOrders.completedAt,
    })
    .from(workOrders)
    .where(
      and(
        eq(workOrders.id, parsed.data.workOrderId),
        eq(workOrders.ranchId, context.ranch.id),
      ),
    )
    .limit(1);

  if (!existing) {
    return { error: "Work order not found for this ranch." };
  }

  const assigneeIds = parseAssigneeIds(formData);
  const validAssigneeIds = await validateAssigneesForRanch(context.ranch.id, assigneeIds);
  if (!validAssigneeIds) {
    return { error: "Invalid assignee selection." };
  }

  if (parsed.data.compensationType === "flat_amount" && validAssigneeIds.length === 0) {
    return { error: "Flat-amount work orders must be assigned to at least one team member." };
  }

  const compensationValues = resolveCompensationValues(parsed.data);
  const incentiveValues = resolveIncentiveValues(parsed.data);
  const completedAt =
    parsed.data.status === "completed"
      ? existing.status === "completed"
        ? existing.completedAt ?? new Date()
        : new Date()
      : null;

  await db
    .update(workOrders)
    .set({
      title: parsed.data.title,
      description: parsed.data.description || null,
      status: parsed.data.status,
      priority: parsed.data.priority,
      dueAt: parseDateTime(parsed.data.dueAt),
      completedAt,
      compensationType: compensationValues.compensationType,
      flatPayCents: compensationValues.flatPayCents,
      incentivePayCents: incentiveValues.incentivePayCents,
      incentiveTimerType: incentiveValues.incentiveTimerType,
      incentiveDurationHours: incentiveValues.incentiveDurationHours,
      incentiveEndsAt: incentiveValues.incentiveEndsAt,
      updatedAt: new Date(),
    })
    .where(eq(workOrders.id, parsed.data.workOrderId));

  if (parsed.data.status !== "completed" || existing.status !== "completed") {
    await db
      .delete(workOrderCompletionReviews)
      .where(eq(workOrderCompletionReviews.workOrderId, parsed.data.workOrderId));
  }

  await replaceAssignments(parsed.data.workOrderId, validAssigneeIds);

  revalidatePath("/app/work-orders");
  revalidatePath(`/app/work-orders/${parsed.data.workOrderId}`);
  revalidatePath("/app/time");
  revalidatePath("/app/payroll");
  return { success: "Work order updated." };
}

export async function reviewCompletedWorkOrderAction(
  _prevState: WorkOrderActionState,
  formData: FormData,
): Promise<WorkOrderActionState> {
  const context = await requireRole(["owner", "manager"]);
  const parsed = reviewChecklistSchema.safeParse({
    workOrderId: formData.get("workOrderId"),
    decision: formData.get("decision"),
    checklistCompletionVerified: parseCheckbox(formData, "checklistCompletionVerified"),
    checklistQualityVerified: parseCheckbox(formData, "checklistQualityVerified"),
    checklistCleanupVerified: parseCheckbox(formData, "checklistCleanupVerified"),
    checklistFollowUpVerified: parseCheckbox(formData, "checklistFollowUpVerified"),
    managerNotes: formData.get("managerNotes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid review checklist." };
  }

  const [review] = await db
    .select({
      id: workOrderCompletionReviews.id,
      status: workOrderCompletionReviews.status,
      workOrderId: workOrderCompletionReviews.workOrderId,
    })
    .from(workOrderCompletionReviews)
    .innerJoin(workOrders, eq(workOrderCompletionReviews.workOrderId, workOrders.id))
    .where(
      and(
        eq(workOrders.ranchId, context.ranch.id),
        eq(workOrderCompletionReviews.workOrderId, parsed.data.workOrderId),
      ),
    )
    .limit(1);

  if (!review) {
    return { error: "No completion review is waiting for this work order." };
  }

  if (review.status !== "pending") {
    return { error: "This work order review has already been resolved." };
  }

  const allChecklistItemsComplete =
    parsed.data.checklistCompletionVerified &&
    parsed.data.checklistQualityVerified &&
    parsed.data.checklistCleanupVerified &&
    parsed.data.checklistFollowUpVerified;

  if (parsed.data.decision === "approve" && !allChecklistItemsComplete) {
    return { error: "Check every review item before approving this work order." };
  }

  const managerNotes = parsed.data.managerNotes?.trim() ? parsed.data.managerNotes.trim() : null;
  if (parsed.data.decision === "send_back" && !managerNotes) {
    return { error: "Add manager notes so the worker knows what still needs attention." };
  }

  const reviewTime = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(workOrderCompletionReviews)
      .set({
        status: parsed.data.decision === "approve" ? "approved" : "changes_requested",
        reviewedByMembershipId: context.membership.id,
        reviewedAt: reviewTime,
        managerNotes,
        checklistCompletionVerified: parsed.data.checklistCompletionVerified,
        checklistQualityVerified: parsed.data.checklistQualityVerified,
        checklistCleanupVerified: parsed.data.checklistCleanupVerified,
        checklistFollowUpVerified: parsed.data.checklistFollowUpVerified,
        updatedAt: reviewTime,
      })
      .where(eq(workOrderCompletionReviews.id, review.id));

    if (parsed.data.decision === "send_back") {
      await tx
        .update(workOrders)
        .set({
          status: "in_progress",
          completedAt: null,
          updatedAt: reviewTime,
        })
        .where(eq(workOrders.id, review.workOrderId));
    }
  });

  revalidatePath("/app");
  revalidatePath("/app/time");
  revalidatePath("/app/work-orders");
  revalidatePath(`/app/work-orders/${parsed.data.workOrderId}`);
  revalidatePath("/app/payroll");

  return {
    success:
      parsed.data.decision === "approve"
        ? "Work order approved."
        : "Work order sent back for follow-up.",
  };
}
