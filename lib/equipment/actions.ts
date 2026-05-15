"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSectionManage } from "@/lib/auth/context";
import { db } from "@/lib/db/client";
import {
  equipmentMaintenanceRecords,
  equipmentRecords,
  ranchMemberships,
  workOrderAssignments,
  workOrders,
} from "@/lib/db/schema";

export interface EquipmentActionState {
  error?: string;
  success?: string;
}

const optionalTextSchema = z.preprocess(
  (value) => (value == null ? "" : String(value).trim()),
  z.string(),
);
const optionalUuidSchema = z.preprocess(
  (value) => {
    const normalized = value == null ? "" : String(value).trim();
    return normalized.length ? normalized : undefined;
  },
  z.string().uuid().optional(),
);
const optionalDateKeySchema = z.preprocess(
  (value) => {
    const normalized = value == null ? "" : String(value).trim();
    return normalized.length ? normalized : undefined;
  },
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.")
    .optional(),
);
const optionalYearSchema = z.preprocess(
  (value) => (value == null || value === "" ? undefined : value),
  z
    .coerce
    .number()
    .int("Year must be a whole number.")
    .min(1900, "Year must be 1900 or newer.")
    .max(2200, "Year must be 2200 or earlier.")
    .optional(),
);
const optionalCurrencySchema = z.preprocess(
  (value) => (value == null || value === "" ? undefined : value),
  z.coerce.number().min(0, "Cost must be zero or greater.").optional(),
);
const optionalBooleanSchema = z.preprocess(
  (value) => value === true || value === "on" || value === "true" || value === "1",
  z.boolean(),
);

const equipmentSchema = z.object({
  name: z.string().trim().min(1, "Equipment name is required."),
  equipmentType: z.enum([
    "truck",
    "tractor",
    "trailer",
    "atv",
    "utv",
    "implement",
    "pump",
    "tool",
    "other",
  ]),
  status: z.enum(["active", "needs_maintenance", "down", "retired"]),
  identifier: optionalTextSchema,
  make: optionalTextSchema,
  model: optionalTextSchema,
  year: optionalYearSchema,
  serialNumber: optionalTextSchema,
  plateVin: optionalTextSchema,
  currentLocation: optionalTextSchema,
  notes: optionalTextSchema,
});

const updateEquipmentSchema = equipmentSchema.extend({
  equipmentId: z.string().uuid(),
});

const maintenanceBaseSchema = z
  .object({
    equipmentId: z.string().uuid(),
    title: z.string().trim().min(1, "Maintenance title is required."),
    maintenanceType: z.enum([
      "routine",
      "repair",
      "inspection",
      "oil_change",
      "tire",
      "fluids",
      "service",
      "other",
    ]),
    status: z.enum([
      "scheduled",
      "due",
      "overdue",
      "in_progress",
      "completed",
      "cancelled",
    ]),
    priority: z.enum(["low", "normal", "high"]),
    dueOn: optionalDateKeySchema,
    completedOn: optionalDateKeySchema,
    assignedMembershipId: optionalUuidSchema,
    relatedWorkOrderId: optionalUuidSchema,
    createWorkOrder: optionalBooleanSchema,
    costDollars: optionalCurrencySchema,
    notes: optionalTextSchema,
  })
  .superRefine((value, ctx) => {
    if (value.createWorkOrder && value.relatedWorkOrderId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["relatedWorkOrderId"],
        message: "Choose either an existing work order or create a new one, not both.",
      });
    }

    if (value.completedOn && value.status !== "completed") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["completedOn"],
        message: "Completed date can only be set when status is Completed.",
      });
    }
  });

const createMaintenanceSchema = maintenanceBaseSchema;

const updateMaintenanceSchema = maintenanceBaseSchema.extend({
  maintenanceId: z.string().uuid(),
});

const maintenanceStatusActionSchema = z.object({
  maintenanceId: z.string().uuid(),
});

function normalizeText(value: string): string | null {
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

function toCents(value?: number): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  return Math.round(value * 100);
}

function toDateAtNoonUtc(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00.000Z`);
}

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function resolveEquipmentForRanch(ranchId: string, equipmentId: string) {
  const [equipment] = await db
    .select({
      id: equipmentRecords.id,
      ranchId: equipmentRecords.ranchId,
      name: equipmentRecords.name,
    })
    .from(equipmentRecords)
    .where(and(eq(equipmentRecords.id, equipmentId), eq(equipmentRecords.ranchId, ranchId)))
    .limit(1);

  return equipment ?? null;
}

async function validateActiveMembershipForRanch(
  ranchId: string,
  membershipId: string | undefined,
): Promise<string | null | "invalid"> {
  if (!membershipId) {
    return null;
  }

  const [membership] = await db
    .select({ id: ranchMemberships.id })
    .from(ranchMemberships)
    .where(
      and(
        eq(ranchMemberships.id, membershipId),
        eq(ranchMemberships.ranchId, ranchId),
        eq(ranchMemberships.isActive, true),
      ),
    )
    .limit(1);

  return membership ? membership.id : "invalid";
}

async function validateWorkOrderForRanch(
  ranchId: string,
  workOrderId: string | undefined,
): Promise<string | null | "invalid"> {
  if (!workOrderId) {
    return null;
  }

  const [workOrder] = await db
    .select({
      id: workOrders.id,
      ranchId: workOrders.ranchId,
    })
    .from(workOrders)
    .where(and(eq(workOrders.id, workOrderId), eq(workOrders.ranchId, ranchId)))
    .limit(1);

  return workOrder ? workOrder.id : "invalid";
}

async function createRelatedWorkOrder(params: {
  ranchId: string;
  createdByMembershipId: string;
  equipmentName: string;
  maintenanceTitle: string;
  maintenanceNotes: string | null;
  priority: "low" | "normal" | "high";
  dueOn: string | undefined;
  assigneeMembershipId: string | null;
}) {
  const descriptionLines = [
    `Equipment: ${params.equipmentName}`,
    params.maintenanceNotes ? `Maintenance notes: ${params.maintenanceNotes}` : null,
  ].filter((line): line is string => Boolean(line));

  const [createdWorkOrder] = await db
    .insert(workOrders)
    .values({
      ranchId: params.ranchId,
      title: params.maintenanceTitle,
      description: descriptionLines.join("\n"),
      status: "open",
      priority: params.priority,
      dueAt: params.dueOn ? toDateAtNoonUtc(params.dueOn) : null,
      createdByMembershipId: params.createdByMembershipId,
    })
    .returning({
      id: workOrders.id,
    });

  if (params.assigneeMembershipId) {
    await db.insert(workOrderAssignments).values({
      workOrderId: createdWorkOrder.id,
      membershipId: params.assigneeMembershipId,
    });
  }

  return createdWorkOrder.id;
}

function resolveMaintenanceCompletionDate(
  status: "scheduled" | "due" | "overdue" | "in_progress" | "completed" | "cancelled",
  completedOn: string | undefined,
  existingCompletedOn?: string | null,
): string | null {
  if (status === "completed") {
    return completedOn ?? existingCompletedOn ?? todayDateKey();
  }
  return null;
}

function revalidateEquipmentPaths(equipmentId: string) {
  revalidatePath("/app");
  revalidatePath("/app/equipment");
  revalidatePath(`/app/equipment/${equipmentId}`);
}

export async function createEquipmentAction(
  _prevState: EquipmentActionState,
  formData: FormData,
): Promise<EquipmentActionState> {
  const context = await requireSectionManage("land");
  const parsed = equipmentSchema.safeParse({
    name: formData.get("name"),
    equipmentType: formData.get("equipmentType"),
    status: formData.get("status"),
    identifier: formData.get("identifier"),
    make: formData.get("make"),
    model: formData.get("model"),
    year: formData.get("year"),
    serialNumber: formData.get("serialNumber"),
    plateVin: formData.get("plateVin"),
    currentLocation: formData.get("currentLocation"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid equipment details." };
  }

  const [equipment] = await db
    .insert(equipmentRecords)
    .values({
      ranchId: context.ranch.id,
      name: parsed.data.name,
      equipmentType: parsed.data.equipmentType,
      status: parsed.data.status,
      identifier: normalizeText(parsed.data.identifier),
      make: normalizeText(parsed.data.make),
      model: normalizeText(parsed.data.model),
      year: parsed.data.year ?? null,
      serialNumber: normalizeText(parsed.data.serialNumber),
      plateVin: normalizeText(parsed.data.plateVin),
      currentLocation: normalizeText(parsed.data.currentLocation),
      notes: normalizeText(parsed.data.notes),
    })
    .returning({
      id: equipmentRecords.id,
      name: equipmentRecords.name,
    });

  revalidateEquipmentPaths(equipment.id);
  return { success: `Added equipment "${equipment.name}".` };
}

export async function updateEquipmentAction(
  _prevState: EquipmentActionState,
  formData: FormData,
): Promise<EquipmentActionState> {
  const context = await requireSectionManage("land");
  const parsed = updateEquipmentSchema.safeParse({
    equipmentId: formData.get("equipmentId"),
    name: formData.get("name"),
    equipmentType: formData.get("equipmentType"),
    status: formData.get("status"),
    identifier: formData.get("identifier"),
    make: formData.get("make"),
    model: formData.get("model"),
    year: formData.get("year"),
    serialNumber: formData.get("serialNumber"),
    plateVin: formData.get("plateVin"),
    currentLocation: formData.get("currentLocation"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid equipment update." };
  }

  const equipment = await resolveEquipmentForRanch(context.ranch.id, parsed.data.equipmentId);
  if (!equipment) {
    return { error: "Equipment not found for this ranch." };
  }

  await db
    .update(equipmentRecords)
    .set({
      name: parsed.data.name,
      equipmentType: parsed.data.equipmentType,
      status: parsed.data.status,
      identifier: normalizeText(parsed.data.identifier),
      make: normalizeText(parsed.data.make),
      model: normalizeText(parsed.data.model),
      year: parsed.data.year ?? null,
      serialNumber: normalizeText(parsed.data.serialNumber),
      plateVin: normalizeText(parsed.data.plateVin),
      currentLocation: normalizeText(parsed.data.currentLocation),
      notes: normalizeText(parsed.data.notes),
      updatedAt: new Date(),
    })
    .where(eq(equipmentRecords.id, parsed.data.equipmentId));

  revalidateEquipmentPaths(parsed.data.equipmentId);
  return { success: `Updated equipment "${parsed.data.name}".` };
}

export async function createMaintenanceRecordAction(
  _prevState: EquipmentActionState,
  formData: FormData,
): Promise<EquipmentActionState> {
  const context = await requireSectionManage("land");
  const parsed = createMaintenanceSchema.safeParse({
    equipmentId: formData.get("equipmentId"),
    title: formData.get("title"),
    maintenanceType: formData.get("maintenanceType"),
    status: formData.get("status"),
    priority: formData.get("priority"),
    dueOn: formData.get("dueOn"),
    completedOn: formData.get("completedOn"),
    assignedMembershipId: formData.get("assignedMembershipId"),
    relatedWorkOrderId: formData.get("relatedWorkOrderId"),
    createWorkOrder: formData.get("createWorkOrder"),
    costDollars: formData.get("costDollars"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid maintenance details." };
  }

  const equipment = await resolveEquipmentForRanch(context.ranch.id, parsed.data.equipmentId);
  if (!equipment) {
    return { error: "Equipment not found for this ranch." };
  }

  const [assignedMembershipId, existingRelatedWorkOrderId] = await Promise.all([
    validateActiveMembershipForRanch(context.ranch.id, parsed.data.assignedMembershipId),
    validateWorkOrderForRanch(context.ranch.id, parsed.data.relatedWorkOrderId),
  ]);

  if (assignedMembershipId === "invalid") {
    return { error: "Assigned person must be an active member of this ranch." };
  }
  if (existingRelatedWorkOrderId === "invalid") {
    return { error: "Related work order not found for this ranch." };
  }

  const notes = normalizeText(parsed.data.notes);
  const workOrderId =
    parsed.data.createWorkOrder
      ? await createRelatedWorkOrder({
          ranchId: context.ranch.id,
          createdByMembershipId: context.membership.id,
          equipmentName: equipment.name,
          maintenanceTitle: parsed.data.title,
          maintenanceNotes: notes,
          priority: parsed.data.priority,
          dueOn: parsed.data.dueOn,
          assigneeMembershipId: assignedMembershipId,
        })
      : existingRelatedWorkOrderId;

  await db
    .insert(equipmentMaintenanceRecords)
    .values({
      ranchId: context.ranch.id,
      equipmentId: equipment.id,
      title: parsed.data.title,
      maintenanceType: parsed.data.maintenanceType,
      status: parsed.data.status,
      priority: parsed.data.priority,
      dueOn: parsed.data.dueOn ?? null,
      completedOn: resolveMaintenanceCompletionDate(
        parsed.data.status,
        parsed.data.completedOn,
      ),
      assignedMembershipId,
      relatedWorkOrderId: workOrderId,
      costCents: toCents(parsed.data.costDollars),
      notes,
      createdByMembershipId: context.membership.id,
    });

  revalidateEquipmentPaths(equipment.id);
  revalidatePath("/app/work-orders");
  if (workOrderId) {
    revalidatePath(`/app/work-orders/${workOrderId}`);
  }

  return {
    success: workOrderId
      ? `Saved maintenance and linked work order for "${equipment.name}".`
      : `Saved maintenance for "${equipment.name}".`,
  };
}

export async function updateMaintenanceRecordAction(
  _prevState: EquipmentActionState,
  formData: FormData,
): Promise<EquipmentActionState> {
  const context = await requireSectionManage("land");
  const parsed = updateMaintenanceSchema.safeParse({
    maintenanceId: formData.get("maintenanceId"),
    equipmentId: formData.get("equipmentId"),
    title: formData.get("title"),
    maintenanceType: formData.get("maintenanceType"),
    status: formData.get("status"),
    priority: formData.get("priority"),
    dueOn: formData.get("dueOn"),
    completedOn: formData.get("completedOn"),
    assignedMembershipId: formData.get("assignedMembershipId"),
    relatedWorkOrderId: formData.get("relatedWorkOrderId"),
    createWorkOrder: formData.get("createWorkOrder"),
    costDollars: formData.get("costDollars"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid maintenance update." };
  }

  const [maintenance, equipment] = await Promise.all([
    db
      .select({
        id: equipmentMaintenanceRecords.id,
        equipmentId: equipmentMaintenanceRecords.equipmentId,
        completedOn: equipmentMaintenanceRecords.completedOn,
      })
      .from(equipmentMaintenanceRecords)
      .where(
        and(
          eq(equipmentMaintenanceRecords.id, parsed.data.maintenanceId),
          eq(equipmentMaintenanceRecords.ranchId, context.ranch.id),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
    resolveEquipmentForRanch(context.ranch.id, parsed.data.equipmentId),
  ]);

  if (!maintenance) {
    return { error: "Maintenance record not found for this ranch." };
  }
  if (!equipment || maintenance.equipmentId !== equipment.id) {
    return { error: "Equipment mismatch for this maintenance record." };
  }

  const [assignedMembershipId, existingRelatedWorkOrderId] = await Promise.all([
    validateActiveMembershipForRanch(context.ranch.id, parsed.data.assignedMembershipId),
    validateWorkOrderForRanch(context.ranch.id, parsed.data.relatedWorkOrderId),
  ]);

  if (assignedMembershipId === "invalid") {
    return { error: "Assigned person must be an active member of this ranch." };
  }
  if (existingRelatedWorkOrderId === "invalid") {
    return { error: "Related work order not found for this ranch." };
  }

  const notes = normalizeText(parsed.data.notes);
  const workOrderId =
    parsed.data.createWorkOrder
      ? await createRelatedWorkOrder({
          ranchId: context.ranch.id,
          createdByMembershipId: context.membership.id,
          equipmentName: equipment.name,
          maintenanceTitle: parsed.data.title,
          maintenanceNotes: notes,
          priority: parsed.data.priority,
          dueOn: parsed.data.dueOn,
          assigneeMembershipId: assignedMembershipId,
        })
      : existingRelatedWorkOrderId;

  await db
    .update(equipmentMaintenanceRecords)
    .set({
      equipmentId: equipment.id,
      title: parsed.data.title,
      maintenanceType: parsed.data.maintenanceType,
      status: parsed.data.status,
      priority: parsed.data.priority,
      dueOn: parsed.data.dueOn ?? null,
      completedOn: resolveMaintenanceCompletionDate(
        parsed.data.status,
        parsed.data.completedOn,
        maintenance.completedOn,
      ),
      assignedMembershipId,
      relatedWorkOrderId: workOrderId,
      costCents: toCents(parsed.data.costDollars),
      notes,
      updatedAt: new Date(),
    })
    .where(eq(equipmentMaintenanceRecords.id, maintenance.id));

  revalidateEquipmentPaths(equipment.id);
  revalidatePath("/app/work-orders");
  if (workOrderId) {
    revalidatePath(`/app/work-orders/${workOrderId}`);
  }

  return {
    success: workOrderId
      ? `Updated maintenance and linked work order for "${equipment.name}".`
      : `Updated maintenance for "${equipment.name}".`,
  };
}

export async function completeMaintenanceRecordAction(
  _prevState: EquipmentActionState,
  formData: FormData,
): Promise<EquipmentActionState> {
  const context = await requireSectionManage("land");
  const parsed = maintenanceStatusActionSchema.safeParse({
    maintenanceId: formData.get("maintenanceId"),
  });

  if (!parsed.success) {
    return { error: "Invalid maintenance selection." };
  }

  const [maintenance] = await db
    .select({
      id: equipmentMaintenanceRecords.id,
      equipmentId: equipmentMaintenanceRecords.equipmentId,
      title: equipmentMaintenanceRecords.title,
    })
    .from(equipmentMaintenanceRecords)
    .where(
      and(
        eq(equipmentMaintenanceRecords.id, parsed.data.maintenanceId),
        eq(equipmentMaintenanceRecords.ranchId, context.ranch.id),
      ),
    )
    .limit(1);

  if (!maintenance) {
    return { error: "Maintenance record not found for this ranch." };
  }

  await db
    .update(equipmentMaintenanceRecords)
    .set({
      status: "completed",
      completedOn: todayDateKey(),
      updatedAt: new Date(),
    })
    .where(eq(equipmentMaintenanceRecords.id, maintenance.id));

  revalidateEquipmentPaths(maintenance.equipmentId);
  return { success: `Marked "${maintenance.title}" completed.` };
}

export async function cancelMaintenanceRecordAction(
  _prevState: EquipmentActionState,
  formData: FormData,
): Promise<EquipmentActionState> {
  const context = await requireSectionManage("land");
  const parsed = maintenanceStatusActionSchema.safeParse({
    maintenanceId: formData.get("maintenanceId"),
  });

  if (!parsed.success) {
    return { error: "Invalid maintenance selection." };
  }

  const [maintenance] = await db
    .select({
      id: equipmentMaintenanceRecords.id,
      equipmentId: equipmentMaintenanceRecords.equipmentId,
      title: equipmentMaintenanceRecords.title,
    })
    .from(equipmentMaintenanceRecords)
    .where(
      and(
        eq(equipmentMaintenanceRecords.id, parsed.data.maintenanceId),
        eq(equipmentMaintenanceRecords.ranchId, context.ranch.id),
      ),
    )
    .limit(1);

  if (!maintenance) {
    return { error: "Maintenance record not found for this ranch." };
  }

  await db
    .update(equipmentMaintenanceRecords)
    .set({
      status: "cancelled",
      completedOn: null,
      updatedAt: new Date(),
    })
    .where(eq(equipmentMaintenanceRecords.id, maintenance.id));

  revalidateEquipmentPaths(maintenance.equipmentId);
  return { success: `Cancelled "${maintenance.title}".` };
}
