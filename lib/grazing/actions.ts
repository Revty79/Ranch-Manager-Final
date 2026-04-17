"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/context";
import { db } from "@/lib/db/client";
import {
  animalGroupMemberships,
  animalGroups,
  animals,
  grazingPeriodAnimals,
  grazingPeriods,
  herdLandSettings,
  landUnits,
} from "@/lib/db/schema";
import {
  getOrCreateHerdLandSettings,
  resolveGrazingAssumptions,
} from "@/lib/grazing/settings";

export interface GrazingActionState {
  error?: string;
  success?: string;
}

const optionalTextSchema = z.preprocess(
  (value) => (value == null ? "" : String(value).trim()),
  z.string(),
);

const dateStringSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.");

const optionalDateSchema = z.preprocess(
  (value) => (value == null || value === "" ? undefined : String(value).trim()),
  dateStringSchema.optional(),
);

const updateGrazingAssumptionsSchema = z.object({
  planningDemandBasis: z.string().trim().min(1, "Demand basis is required."),
  demandLbsPerAnimalUnitDay: z.coerce
    .number()
    .positive("Demand basis must be greater than zero."),
  defaultUtilizationPercent: z.coerce
    .number()
    .int()
    .min(1, "Utilization must be at least 1%.")
    .max(100, "Utilization cannot exceed 100%."),
  defaultRestDays: z.coerce.number().int().min(0, "Rest days cannot be negative."),
  cattleMultiplier: z.coerce.number().positive("Multiplier must be greater than zero."),
  horseMultiplier: z.coerce.number().positive("Multiplier must be greater than zero."),
  otherMultiplier: z.coerce.number().positive("Multiplier must be greater than zero."),
  classMultipliersText: optionalTextSchema,
});

const createGrazingPeriodSchema = z
  .object({
    landUnitId: z.string().uuid(),
    animalGroupId: z.preprocess(
      (value) => (value == null || value === "" ? undefined : String(value).trim()),
      z.string().uuid().optional(),
    ),
    status: z.enum(["planned", "active", "completed", "cancelled"]).default("active"),
    startedOn: dateStringSchema,
    endedOn: optionalDateSchema,
    plannedMoveOn: optionalDateSchema,
    notes: optionalTextSchema,
    animalIds: z.array(z.string().uuid()).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.endedOn && value.endedOn < value.startedOn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endedOn"],
        message: "End date cannot be before start date.",
      });
    }

    if (value.status === "completed" && !value.endedOn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endedOn"],
        message: "Completed periods require an end date.",
      });
    }
  });

const completeGrazingPeriodSchema = z.object({
  grazingPeriodId: z.string().uuid(),
  endedOn: dateStringSchema,
});

function normalizeText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function parseClassMultiplierText(text: string): Record<string, number> {
  if (!text.trim()) return {};
  const output: Record<string, number> = {};
  const chunks = text
    .split(/\r?\n|,/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  for (const chunk of chunks) {
    const [rawKey, rawValue] = chunk.split("=");
    if (!rawKey || !rawValue) continue;
    const key = rawKey.trim().toLowerCase();
    const value = Number.parseFloat(rawValue.trim());
    if (!key || !Number.isFinite(value) || value <= 0) continue;
    output[key] = value;
  }

  return output;
}

export async function updateGrazingAssumptionsAction(
  _prevState: GrazingActionState,
  formData: FormData,
): Promise<GrazingActionState> {
  const context = await requireRole(["owner", "manager"]);
  const parsed = updateGrazingAssumptionsSchema.safeParse({
    planningDemandBasis: formData.get("planningDemandBasis"),
    demandLbsPerAnimalUnitDay: formData.get("demandLbsPerAnimalUnitDay"),
    defaultUtilizationPercent: formData.get("defaultUtilizationPercent"),
    defaultRestDays: formData.get("defaultRestDays"),
    cattleMultiplier: formData.get("cattleMultiplier"),
    horseMultiplier: formData.get("horseMultiplier"),
    otherMultiplier: formData.get("otherMultiplier"),
    classMultipliersText: formData.get("classMultipliersText"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid grazing assumption values.",
    };
  }

  const settingsRow = await getOrCreateHerdLandSettings(context.ranch.id);
  const current = resolveGrazingAssumptions(settingsRow.grazingDefaults);

  await db
    .update(herdLandSettings)
    .set({
      grazingDefaults: {
        ...current,
        planningDemandBasis: parsed.data.planningDemandBasis,
        demandLbsPerAnimalUnitDay: parsed.data.demandLbsPerAnimalUnitDay,
        defaultUtilizationPercent: parsed.data.defaultUtilizationPercent,
        defaultRestDays: parsed.data.defaultRestDays,
        speciesMultipliers: {
          cattle: parsed.data.cattleMultiplier,
          horse: parsed.data.horseMultiplier,
          other: parsed.data.otherMultiplier,
        },
        classMultipliers: parseClassMultiplierText(parsed.data.classMultipliersText),
      },
      updatedAt: new Date(),
    })
    .where(eq(herdLandSettings.ranchId, context.ranch.id));

  revalidatePath("/app/land");
  revalidatePath("/app/land/grazing");
  return { success: "Grazing assumptions updated." };
}

export async function createGrazingPeriodAction(
  _prevState: GrazingActionState,
  formData: FormData,
): Promise<GrazingActionState> {
  const context = await requireRole(["owner", "manager"]);
  const parsed = createGrazingPeriodSchema.safeParse({
    landUnitId: formData.get("landUnitId"),
    animalGroupId: formData.get("animalGroupId"),
    status: formData.get("status"),
    startedOn: formData.get("startedOn"),
    endedOn: formData.get("endedOn"),
    plannedMoveOn: formData.get("plannedMoveOn"),
    notes: formData.get("notes"),
    animalIds: formData.getAll("animalIds").map((value) => String(value)),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid grazing period." };
  }

  const [unit, group] = await Promise.all([
    db
      .select({ id: landUnits.id })
      .from(landUnits)
      .where(and(eq(landUnits.id, parsed.data.landUnitId), eq(landUnits.ranchId, context.ranch.id)))
      .limit(1),
    parsed.data.animalGroupId
      ? db
          .select({ id: animalGroups.id })
          .from(animalGroups)
          .where(
            and(
              eq(animalGroups.id, parsed.data.animalGroupId),
              eq(animalGroups.ranchId, context.ranch.id),
            ),
          )
          .limit(1)
      : Promise.resolve([]),
  ]);

  if (!unit[0]) {
    return { error: "Land unit not found for this ranch." };
  }

  if (parsed.data.animalGroupId && !group[0]) {
    return { error: "Selected animal group is not in this ranch." };
  }

  const submittedAnimalIds = [...new Set(parsed.data.animalIds)];
  let effectiveAnimalIds = submittedAnimalIds;

  if (parsed.data.animalGroupId && submittedAnimalIds.length === 0) {
    const groupMemberRows = await db
      .select({
        animalId: animalGroupMemberships.animalId,
      })
      .from(animalGroupMemberships)
      .innerJoin(animals, eq(animalGroupMemberships.animalId, animals.id))
      .where(
        and(
          eq(animalGroupMemberships.ranchId, context.ranch.id),
          eq(animalGroupMemberships.animalGroupId, parsed.data.animalGroupId),
          eq(animalGroupMemberships.isActive, true),
          eq(animals.status, "active"),
          eq(animals.isArchived, false),
        ),
      );

    effectiveAnimalIds = [...new Set(groupMemberRows.map((row) => row.animalId))];
    if (!effectiveAnimalIds.length) {
      return { error: "Selected herd group has no active members to link." };
    }
  }

  if (effectiveAnimalIds.length) {
    const validAnimals = await db
      .select({ id: animals.id })
      .from(animals)
      .where(
        and(
          eq(animals.ranchId, context.ranch.id),
          inArray(animals.id, effectiveAnimalIds),
        ),
      );
    if (validAnimals.length !== effectiveAnimalIds.length) {
      return { error: "One or more selected animals are invalid for this ranch." };
    }
  }

  await db.transaction(async (tx) => {
    const [period] = await tx
      .insert(grazingPeriods)
      .values({
        ranchId: context.ranch.id,
        landUnitId: parsed.data.landUnitId,
        animalGroupId: parsed.data.animalGroupId ?? null,
        status: parsed.data.status,
        startedOn: parsed.data.startedOn,
        endedOn: parsed.data.endedOn ?? null,
        plannedMoveOn: parsed.data.plannedMoveOn ?? null,
        notes: normalizeText(parsed.data.notes),
        createdByMembershipId: context.membership.id,
      })
      .returning({ id: grazingPeriods.id });

    if (effectiveAnimalIds.length) {
      await tx.insert(grazingPeriodAnimals).values(
        effectiveAnimalIds.map((animalId) => ({
          ranchId: context.ranch.id,
          grazingPeriodId: period.id,
          animalId,
        })),
      );
    }
  });

  revalidatePath("/app/land");
  revalidatePath("/app/land/grazing");
  revalidatePath(`/app/land/${parsed.data.landUnitId}`);
  return { success: "Grazing period recorded." };
}

export async function completeGrazingPeriodAction(
  _prevState: GrazingActionState,
  formData: FormData,
): Promise<GrazingActionState> {
  const context = await requireRole(["owner", "manager"]);
  const parsed = completeGrazingPeriodSchema.safeParse({
    grazingPeriodId: formData.get("grazingPeriodId"),
    endedOn: formData.get("endedOn"),
  });

  if (!parsed.success) {
    return { error: "Invalid completion request." };
  }

  const [period] = await db
    .select({
      id: grazingPeriods.id,
      landUnitId: grazingPeriods.landUnitId,
    })
    .from(grazingPeriods)
    .where(
      and(
        eq(grazingPeriods.id, parsed.data.grazingPeriodId),
        eq(grazingPeriods.ranchId, context.ranch.id),
      ),
    )
    .limit(1);

  if (!period) {
    return { error: "Grazing period not found for this ranch." };
  }

  await db
    .update(grazingPeriods)
    .set({
      status: "completed",
      endedOn: parsed.data.endedOn,
      updatedAt: new Date(),
    })
    .where(eq(grazingPeriods.id, parsed.data.grazingPeriodId));

  revalidatePath("/app/land/grazing");
  revalidatePath(`/app/land/${period.landUnitId}`);
  return { success: "Grazing period completed." };
}
