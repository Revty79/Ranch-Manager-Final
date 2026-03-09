"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/context";
import { db } from "@/lib/db/client";
import { ranchMemberships, workOrderAssignments, workOrders } from "@/lib/db/schema";

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

const workOrderSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters."),
  description: z.string().trim().optional(),
  status: statusSchema,
  priority: prioritySchema,
  dueAt: z.string().trim().optional(),
});

const updateWorkOrderSchema = workOrderSchema.extend({
  workOrderId: z.string().uuid(),
});

function parseDueAt(value?: string): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseAssigneeIds(formData: FormData): string[] {
  return [...new Set(formData.getAll("assigneeIds").map((id) => String(id)).filter(Boolean))];
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
    .select({ membershipId: ranchMemberships.id })
    .from(ranchMemberships)
    .where(
      and(
        eq(ranchMemberships.ranchId, ranchId),
        eq(ranchMemberships.isActive, true),
        inArray(ranchMemberships.id, parsed.data),
      ),
    );

  return rows.map((row) => row.membershipId);
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
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid work-order details." };
  }

  const assigneeIds = parseAssigneeIds(formData);
  const validAssigneeIds = await validateAssigneesForRanch(context.ranch.id, assigneeIds);
  if (!validAssigneeIds) {
    return { error: "Invalid assignee selection." };
  }

  const [newWorkOrder] = await db
    .insert(workOrders)
    .values({
      ranchId: context.ranch.id,
      title: parsed.data.title,
      description: parsed.data.description || null,
      status: parsed.data.status,
      priority: parsed.data.priority,
      dueAt: parseDueAt(parsed.data.dueAt),
      createdByMembershipId: context.membership.id,
    })
    .returning({ id: workOrders.id });

  await replaceAssignments(newWorkOrder.id, validAssigneeIds);

  revalidatePath("/app/work-orders");
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
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid work-order update." };
  }

  const [existing] = await db
    .select({ id: workOrders.id })
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

  await db
    .update(workOrders)
    .set({
      title: parsed.data.title,
      description: parsed.data.description || null,
      status: parsed.data.status,
      priority: parsed.data.priority,
      dueAt: parseDueAt(parsed.data.dueAt),
      updatedAt: new Date(),
    })
    .where(eq(workOrders.id, parsed.data.workOrderId));

  await replaceAssignments(parsed.data.workOrderId, validAssigneeIds);

  revalidatePath("/app/work-orders");
  revalidatePath(`/app/work-orders/${parsed.data.workOrderId}`);
  return { success: "Work order updated." };
}
