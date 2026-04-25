"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSectionManage } from "@/lib/auth/context";
import { db } from "@/lib/db/client";
import {
  animalEvents,
  animalLocationAssignments,
  animals,
  landUnits,
  type AnimalSpecies,
} from "@/lib/db/schema";
import { animalSpeciesOptions, formatAnimalSpecies } from "@/lib/herd/constants";

export interface LandActionState {
  error?: string;
  success?: string;
}

const optionalTextSchema = z.preprocess(
  (value) => (value == null ? "" : String(value).trim()),
  z.string(),
);

const optionalNumberSchema = z.preprocess(
  (value) => (value == null || value === "" ? undefined : value),
  z.coerce.number().min(0, "Use a value of zero or greater.").optional(),
);
const optionalPercentSchema = z.preprocess(
  (value) => (value == null || value === "" ? undefined : value),
  z.coerce
    .number()
    .int("Use a whole-number percent.")
    .min(1, "Percent must be at least 1.")
    .max(100, "Percent cannot exceed 100.")
    .optional(),
);
const optionalDaysSchema = z.preprocess(
  (value) => (value == null || value === "" ? undefined : value),
  z.coerce
    .number()
    .int("Use a whole number of days.")
    .min(0, "Days cannot be negative.")
    .optional(),
);

const landUnitSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required."),
    code: optionalTextSchema,
    unitType: z.enum([
      "pasture",
      "field",
      "trap",
      "lot",
      "corral",
      "pen",
      "stall",
      "barn_area",
      "holding_area",
      "other",
    ]),
    acreage: optionalNumberSchema,
    grazeableAcreage: optionalNumberSchema,
    estimatedForageLbsPerAcre: optionalNumberSchema,
    targetUtilizationPercent: optionalPercentSchema,
    targetRestDays: optionalDaysSchema,
    activityState: z.enum(["active", "inactive"]).default("active"),
    waterSummary: optionalTextSchema,
    fencingSummary: optionalTextSchema,
    seasonalNotes: optionalTextSchema,
    notes: optionalTextSchema,
  })
  .superRefine((value, ctx) => {
    if (
      value.acreage != null &&
      value.grazeableAcreage != null &&
      value.grazeableAcreage > value.acreage
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["grazeableAcreage"],
        message: "Grazeable acreage cannot exceed total acreage.",
      });
    }
  });

const updateLandUnitSchema = landUnitSchema.extend({
  landUnitId: z.string().uuid(),
});

const movementReasonSchema = z.enum([
  "grazing_rotation",
  "feeding",
  "breeding",
  "health_hold",
  "weaning",
  "training",
  "weather",
  "other",
]);

const assignAnimalSchema = z.object({
  landUnitId: z.string().uuid(),
  animalId: z.string().uuid(),
  movementReason: movementReasonSchema.default("other"),
  notes: optionalTextSchema,
});

const speciesValues = new Set<AnimalSpecies>(animalSpeciesOptions.map((option) => option.value));
const speciesSchema = z.preprocess(
  (value) => (value == null ? "" : String(value).trim()),
  z
    .string()
    .refine((value) => speciesValues.has(value as AnimalSpecies), "Select a valid species."),
);

const bulkAssignAnimalsSchema = z.object({
  landUnitId: z.string().uuid(),
  species: speciesSchema,
  movementReason: movementReasonSchema.default("grazing_rotation"),
  notes: optionalTextSchema,
});

const splitMoveAnimalsSchema = z
  .object({
    fromLandUnitId: z.string().uuid(),
    toLandUnitId: z.string().uuid(),
    species: speciesSchema,
    animalClass: optionalTextSchema,
    headCount: z.coerce
      .number()
      .int("Headcount must be a whole number.")
      .min(1, "Move at least one head.")
      .max(5000, "Headcount is too large for one move."),
    movementReason: movementReasonSchema.default("grazing_rotation"),
    notes: optionalTextSchema,
  })
  .superRefine((value, ctx) => {
    if (value.fromLandUnitId === value.toLandUnitId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toLandUnitId"],
        message: "Select a different destination unit.",
      });
    }
  });

const removeAnimalSchema = z.object({
  landUnitId: z.string().uuid(),
  animalId: z.string().uuid(),
  notes: optionalTextSchema,
});

function normalizeText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toNumericValue(value?: number): string | null {
  return typeof value === "number" ? value.toFixed(2) : null;
}

function movementSummary({
  toUnit,
  fromUnit,
}: {
  toUnit: string;
  fromUnit?: string | null;
}): string {
  if (!fromUnit) return `Assigned to ${toUnit}.`;
  return `Moved to ${toUnit} from ${fromUnit}.`;
}

export async function createLandUnitAction(
  _prevState: LandActionState,
  formData: FormData,
): Promise<LandActionState> {
  const context = await requireSectionManage("land");
  const parsed = landUnitSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    unitType: formData.get("unitType"),
    acreage: formData.get("acreage"),
    grazeableAcreage: formData.get("grazeableAcreage"),
    estimatedForageLbsPerAcre: formData.get("estimatedForageLbsPerAcre"),
    targetUtilizationPercent: formData.get("targetUtilizationPercent"),
    targetRestDays: formData.get("targetRestDays"),
    activityState: formData.get("activityState"),
    waterSummary: formData.get("waterSummary"),
    fencingSummary: formData.get("fencingSummary"),
    seasonalNotes: formData.get("seasonalNotes"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid land-unit details." };
  }

  try {
    await db.insert(landUnits).values({
      ranchId: context.ranch.id,
      name: parsed.data.name,
      code: normalizeText(parsed.data.code),
      unitType: parsed.data.unitType,
      isActive: parsed.data.activityState === "active",
      acreage: toNumericValue(parsed.data.acreage),
      grazeableAcreage: toNumericValue(parsed.data.grazeableAcreage),
      estimatedForageLbsPerAcre: toNumericValue(parsed.data.estimatedForageLbsPerAcre),
      targetUtilizationPercent: parsed.data.targetUtilizationPercent ?? null,
      targetRestDays: parsed.data.targetRestDays ?? null,
      waterSummary: normalizeText(parsed.data.waterSummary),
      fencingSummary: normalizeText(parsed.data.fencingSummary),
      seasonalNotes: normalizeText(parsed.data.seasonalNotes),
      notes: normalizeText(parsed.data.notes),
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("land_units_ranch_code_uidx")
        ? "Code must be unique in this ranch."
        : "Unable to create land unit.";
    return { error: message };
  }

  revalidatePath("/app/land");
  return { success: "Land unit created." };
}

export async function updateLandUnitAction(
  _prevState: LandActionState,
  formData: FormData,
): Promise<LandActionState> {
  const context = await requireSectionManage("land");
  const parsed = updateLandUnitSchema.safeParse({
    landUnitId: formData.get("landUnitId"),
    name: formData.get("name"),
    code: formData.get("code"),
    unitType: formData.get("unitType"),
    acreage: formData.get("acreage"),
    grazeableAcreage: formData.get("grazeableAcreage"),
    estimatedForageLbsPerAcre: formData.get("estimatedForageLbsPerAcre"),
    targetUtilizationPercent: formData.get("targetUtilizationPercent"),
    targetRestDays: formData.get("targetRestDays"),
    activityState: formData.get("activityState"),
    waterSummary: formData.get("waterSummary"),
    fencingSummary: formData.get("fencingSummary"),
    seasonalNotes: formData.get("seasonalNotes"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid land-unit update." };
  }

  const [unit] = await db
    .select({ id: landUnits.id })
    .from(landUnits)
    .where(and(eq(landUnits.id, parsed.data.landUnitId), eq(landUnits.ranchId, context.ranch.id)))
    .limit(1);

  if (!unit) {
    return { error: "Land unit not found for this ranch." };
  }

  try {
    await db
      .update(landUnits)
      .set({
        name: parsed.data.name,
        code: normalizeText(parsed.data.code),
        unitType: parsed.data.unitType,
        isActive: parsed.data.activityState === "active",
        acreage: toNumericValue(parsed.data.acreage),
        grazeableAcreage: toNumericValue(parsed.data.grazeableAcreage),
        estimatedForageLbsPerAcre: toNumericValue(parsed.data.estimatedForageLbsPerAcre),
        targetUtilizationPercent: parsed.data.targetUtilizationPercent ?? null,
        targetRestDays: parsed.data.targetRestDays ?? null,
        waterSummary: normalizeText(parsed.data.waterSummary),
        fencingSummary: normalizeText(parsed.data.fencingSummary),
        seasonalNotes: normalizeText(parsed.data.seasonalNotes),
        notes: normalizeText(parsed.data.notes),
        updatedAt: new Date(),
      })
      .where(eq(landUnits.id, parsed.data.landUnitId));
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("land_units_ranch_code_uidx")
        ? "Code must be unique in this ranch."
        : "Unable to update land unit.";
    return { error: message };
  }

  revalidatePath("/app/land");
  revalidatePath(`/app/land/${parsed.data.landUnitId}`);
  return { success: "Land unit updated." };
}

export async function assignAnimalToLandUnitAction(
  _prevState: LandActionState,
  formData: FormData,
): Promise<LandActionState> {
  const context = await requireSectionManage("land");
  const parsed = assignAnimalSchema.safeParse({
    landUnitId: formData.get("landUnitId"),
    animalId: formData.get("animalId"),
    movementReason: formData.get("movementReason"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid movement request." };
  }

  const [landUnit, animal, activeAssignment] = await Promise.all([
    db
      .select({
        id: landUnits.id,
        name: landUnits.name,
        isActive: landUnits.isActive,
      })
      .from(landUnits)
      .where(and(eq(landUnits.id, parsed.data.landUnitId), eq(landUnits.ranchId, context.ranch.id)))
      .limit(1),
    db
      .select({
        id: animals.id,
        status: animals.status,
        isArchived: animals.isArchived,
      })
      .from(animals)
      .where(and(eq(animals.id, parsed.data.animalId), eq(animals.ranchId, context.ranch.id)))
      .limit(1),
    db
      .select({
        assignmentId: animalLocationAssignments.id,
        landUnitId: animalLocationAssignments.landUnitId,
        landUnitName: landUnits.name,
      })
      .from(animalLocationAssignments)
      .innerJoin(landUnits, eq(animalLocationAssignments.landUnitId, landUnits.id))
      .where(
        and(
          eq(animalLocationAssignments.ranchId, context.ranch.id),
          eq(animalLocationAssignments.animalId, parsed.data.animalId),
          eq(animalLocationAssignments.isActive, true),
        ),
      )
      .limit(1),
  ]);

  const targetUnit = landUnit[0];
  const targetAnimal = animal[0];
  const currentAssignment = activeAssignment[0];

  if (!targetUnit) {
    return { error: "Land unit not found for this ranch." };
  }

  if (!targetUnit.isActive) {
    return { error: "Cannot assign into an inactive land unit." };
  }

  if (!targetAnimal) {
    return { error: "Animal not found for this ranch." };
  }

  if (targetAnimal.isArchived || targetAnimal.status !== "active") {
    return { error: "Only active, non-archived animals can be moved." };
  }

  if (currentAssignment?.landUnitId === targetUnit.id) {
    return { error: "This animal is already assigned to this land unit." };
  }

  const movementTime = new Date();
  const movementNotes = normalizeText(parsed.data.notes);

  await db.transaction(async (tx) => {
    if (currentAssignment) {
      await tx
        .update(animalLocationAssignments)
        .set({
          isActive: false,
          endedAt: movementTime,
        })
        .where(eq(animalLocationAssignments.id, currentAssignment.assignmentId));
    }

    await tx.insert(animalLocationAssignments).values({
      ranchId: context.ranch.id,
      animalId: targetAnimal.id,
      landUnitId: targetUnit.id,
      movementReason: parsed.data.movementReason,
      notes: movementNotes,
      assignedAt: movementTime,
      isActive: true,
      assignedByMembershipId: context.membership.id,
    });

    await tx.insert(animalEvents).values({
      ranchId: context.ranch.id,
      animalId: targetAnimal.id,
      eventType: "movement",
      occurredAt: movementTime,
      summary: movementSummary({
        toUnit: targetUnit.name,
        fromUnit: currentAssignment?.landUnitName,
      }),
      details: movementNotes,
      recordedByMembershipId: context.membership.id,
    });
  });

  revalidatePath("/app/land");
  revalidatePath("/app/land/grazing");
  revalidatePath(`/app/land/${targetUnit.id}`);
  revalidatePath("/app");
  if (currentAssignment?.landUnitId) {
    revalidatePath(`/app/land/${currentAssignment.landUnitId}`);
  }
  revalidatePath(`/app/herd/${targetAnimal.id}`);
  revalidatePath("/app/herd");
  return { success: "Movement recorded." };
}

export async function bulkAssignAnimalsToLandUnitAction(
  _prevState: LandActionState,
  formData: FormData,
): Promise<LandActionState> {
  const context = await requireSectionManage("land");
  const parsed = bulkAssignAnimalsSchema.safeParse({
    landUnitId: formData.get("landUnitId"),
    species: formData.get("species"),
    movementReason: formData.get("movementReason"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid bulk movement request." };
  }

  const species = parsed.data.species as AnimalSpecies;
  const speciesLabel = formatAnimalSpecies(species).toLowerCase();
  const [landUnitRows, candidateAnimals] = await Promise.all([
    db
      .select({
        id: landUnits.id,
        name: landUnits.name,
        isActive: landUnits.isActive,
      })
      .from(landUnits)
      .where(and(eq(landUnits.id, parsed.data.landUnitId), eq(landUnits.ranchId, context.ranch.id)))
      .limit(1),
    db
      .select({
        id: animals.id,
      })
      .from(animals)
      .where(
        and(
          eq(animals.ranchId, context.ranch.id),
          eq(animals.status, "active"),
          eq(animals.isArchived, false),
          eq(animals.species, species),
        ),
      ),
  ]);

  const targetUnit = landUnitRows[0];
  if (!targetUnit) {
    return { error: "Land unit not found for this ranch." };
  }
  if (!targetUnit.isActive) {
    return { error: "Cannot assign into an inactive land unit." };
  }
  if (!candidateAnimals.length) {
    return { error: `No active ${speciesLabel} are available to move.` };
  }

  const activeAssignments = await db
    .select({
      assignmentId: animalLocationAssignments.id,
      animalId: animalLocationAssignments.animalId,
      landUnitId: animalLocationAssignments.landUnitId,
      landUnitName: landUnits.name,
    })
    .from(animalLocationAssignments)
    .innerJoin(landUnits, eq(animalLocationAssignments.landUnitId, landUnits.id))
    .where(
      and(
        eq(animalLocationAssignments.ranchId, context.ranch.id),
        eq(animalLocationAssignments.isActive, true),
        inArray(
          animalLocationAssignments.animalId,
          candidateAnimals.map((animal) => animal.id),
        ),
      ),
    );

  const activeByAnimalId = new Map(
    activeAssignments.map((assignment) => [assignment.animalId, assignment] as const),
  );

  const animalsToMove = candidateAnimals.filter(
    (animal) => activeByAnimalId.get(animal.id)?.landUnitId !== targetUnit.id,
  );

  if (!animalsToMove.length) {
    return { success: `All active ${speciesLabel} are already in ${targetUnit.name}.` };
  }

  const movementTime = new Date();
  const movementNotes = normalizeText(parsed.data.notes);

  await db.transaction(async (tx) => {
    const assignmentIdsToClose = animalsToMove
      .map((animal) => activeByAnimalId.get(animal.id)?.assignmentId ?? null)
      .filter((assignmentId): assignmentId is string => Boolean(assignmentId));

    if (assignmentIdsToClose.length) {
      await tx
        .update(animalLocationAssignments)
        .set({
          isActive: false,
          endedAt: movementTime,
        })
        .where(inArray(animalLocationAssignments.id, assignmentIdsToClose));
    }

    await tx.insert(animalLocationAssignments).values(
      animalsToMove.map((animal) => ({
        ranchId: context.ranch.id,
        animalId: animal.id,
        landUnitId: targetUnit.id,
        movementReason: parsed.data.movementReason,
        notes: movementNotes,
        assignedAt: movementTime,
        isActive: true,
        assignedByMembershipId: context.membership.id,
      })),
    );

    await tx.insert(animalEvents).values(
      animalsToMove.map((animal) => {
        const previous = activeByAnimalId.get(animal.id);
        return {
          ranchId: context.ranch.id,
          animalId: animal.id,
          eventType: "movement" as const,
          occurredAt: movementTime,
          summary: movementSummary({
            toUnit: targetUnit.name,
            fromUnit: previous?.landUnitName ?? null,
          }),
          details: movementNotes,
          recordedByMembershipId: context.membership.id,
        };
      }),
    );
  });

  revalidatePath("/app");
  revalidatePath("/app/land");
  revalidatePath("/app/land/grazing");
  revalidatePath(`/app/land/${targetUnit.id}`);
  revalidatePath("/app/herd");

  return {
    success: `Moved ${animalsToMove.length} ${speciesLabel} to ${targetUnit.name}.`,
  };
}

export async function removeAnimalFromLandUnitAction(
  _prevState: LandActionState,
  formData: FormData,
): Promise<LandActionState> {
  const context = await requireSectionManage("land");
  const parsed = removeAnimalSchema.safeParse({
    landUnitId: formData.get("landUnitId"),
    animalId: formData.get("animalId"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid removal request." };
  }

  const [landUnitRow, activeAssignment] = await Promise.all([
    db
      .select({ id: landUnits.id, name: landUnits.name })
      .from(landUnits)
      .where(and(eq(landUnits.id, parsed.data.landUnitId), eq(landUnits.ranchId, context.ranch.id)))
      .limit(1),
    db
      .select({
        assignmentId: animalLocationAssignments.id,
        animalId: animalLocationAssignments.animalId,
      })
      .from(animalLocationAssignments)
      .where(
        and(
          eq(animalLocationAssignments.ranchId, context.ranch.id),
          eq(animalLocationAssignments.landUnitId, parsed.data.landUnitId),
          eq(animalLocationAssignments.animalId, parsed.data.animalId),
          eq(animalLocationAssignments.isActive, true),
        ),
      )
      .limit(1),
  ]);

  const landUnit = landUnitRow[0];
  const assignment = activeAssignment[0];
  if (!landUnit || !assignment) {
    return { error: "No active occupancy found for this animal in this unit." };
  }

  const movementTime = new Date();
  const movementNotes = normalizeText(parsed.data.notes);

  await db.transaction(async (tx) => {
    await tx
      .update(animalLocationAssignments)
      .set({
        isActive: false,
        endedAt: movementTime,
      })
      .where(eq(animalLocationAssignments.id, assignment.assignmentId));

    await tx.insert(animalEvents).values({
      ranchId: context.ranch.id,
      animalId: assignment.animalId,
      eventType: "movement",
      occurredAt: movementTime,
      summary: `Removed from ${landUnit.name}.`,
      details: movementNotes,
      recordedByMembershipId: context.membership.id,
    });
  });

  revalidatePath("/app/land");
  revalidatePath("/app/land/grazing");
  revalidatePath(`/app/land/${landUnit.id}`);
  revalidatePath(`/app/herd/${assignment.animalId}`);
  revalidatePath("/app/herd");
  return { success: "Animal removed from this unit." };
}

export async function bulkMoveHeadcountFromUnitAction(
  _prevState: LandActionState,
  formData: FormData,
): Promise<LandActionState> {
  const context = await requireSectionManage("land");
  const parsed = splitMoveAnimalsSchema.safeParse({
    fromLandUnitId: formData.get("fromLandUnitId"),
    toLandUnitId: formData.get("toLandUnitId"),
    species: formData.get("species"),
    animalClass: formData.get("animalClass"),
    headCount: formData.get("headCount"),
    movementReason: formData.get("movementReason"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid split-move request." };
  }

  const species = parsed.data.species as AnimalSpecies;
  const animalClassFilter = normalizeText(parsed.data.animalClass);
  const speciesLabel = formatAnimalSpecies(species).toLowerCase();
  const classSuffix = animalClassFilter ? ` (${animalClassFilter})` : "";

  const [fromLandRows, toLandRows] = await Promise.all([
    db
      .select({
        id: landUnits.id,
        name: landUnits.name,
      })
      .from(landUnits)
      .where(
        and(
          eq(landUnits.id, parsed.data.fromLandUnitId),
          eq(landUnits.ranchId, context.ranch.id),
        ),
      )
      .limit(1),
    db
      .select({
        id: landUnits.id,
        name: landUnits.name,
        isActive: landUnits.isActive,
      })
      .from(landUnits)
      .where(
        and(
          eq(landUnits.id, parsed.data.toLandUnitId),
          eq(landUnits.ranchId, context.ranch.id),
        ),
      )
      .limit(1),
  ]);

  const fromLandUnit = fromLandRows[0];
  const toLandUnit = toLandRows[0];

  if (!fromLandUnit) {
    return { error: "Source unit not found for this ranch." };
  }
  if (!toLandUnit) {
    return { error: "Destination unit not found for this ranch." };
  }
  if (!toLandUnit.isActive) {
    return { error: "Cannot move animals into an inactive destination unit." };
  }

  const animalSelectionConditions = [
    eq(animalLocationAssignments.ranchId, context.ranch.id),
    eq(animalLocationAssignments.landUnitId, fromLandUnit.id),
    eq(animalLocationAssignments.isActive, true),
    eq(animals.status, "active"),
    eq(animals.isArchived, false),
    eq(animals.species, species),
  ];
  if (animalClassFilter) {
    animalSelectionConditions.push(eq(animals.animalClass, animalClassFilter));
  }

  const [availableRows, selectedRows] = await Promise.all([
    db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(animalLocationAssignments)
      .innerJoin(animals, eq(animalLocationAssignments.animalId, animals.id))
      .where(and(...animalSelectionConditions)),
    db
      .select({
        assignmentId: animalLocationAssignments.id,
        animalId: animalLocationAssignments.animalId,
      })
      .from(animalLocationAssignments)
      .innerJoin(animals, eq(animalLocationAssignments.animalId, animals.id))
      .where(and(...animalSelectionConditions))
      .orderBy(animalLocationAssignments.assignedAt)
      .limit(parsed.data.headCount),
  ]);

  const availableCount = availableRows[0]?.count ?? 0;
  if (availableCount < parsed.data.headCount) {
    return {
      error: `Only ${availableCount} active ${speciesLabel}${classSuffix} are currently in ${fromLandUnit.name}.`,
    };
  }
  if (!selectedRows.length) {
    return { error: `No active ${speciesLabel}${classSuffix} are available to move from this unit.` };
  }

  const movementTime = new Date();
  const movementNotes = normalizeText(parsed.data.notes);
  const movementBatchKey = `split-${movementTime.getTime()}`;

  await db.transaction(async (tx) => {
    await tx
      .update(animalLocationAssignments)
      .set({
        isActive: false,
        endedAt: movementTime,
      })
      .where(
        inArray(
          animalLocationAssignments.id,
          selectedRows.map((row) => row.assignmentId),
        ),
      );

    await tx.insert(animalLocationAssignments).values(
      selectedRows.map((row) => ({
        ranchId: context.ranch.id,
        animalId: row.animalId,
        landUnitId: toLandUnit.id,
        movementReason: parsed.data.movementReason,
        movementBatchKey,
        notes: movementNotes,
        assignedAt: movementTime,
        isActive: true,
        assignedByMembershipId: context.membership.id,
      })),
    );

    await tx.insert(animalEvents).values(
      selectedRows.map((row) => ({
        ranchId: context.ranch.id,
        animalId: row.animalId,
        eventType: "movement" as const,
        occurredAt: movementTime,
        summary: movementSummary({
          toUnit: toLandUnit.name,
          fromUnit: fromLandUnit.name,
        }),
        details: movementNotes,
        recordedByMembershipId: context.membership.id,
      })),
    );
  });

  revalidatePath("/app");
  revalidatePath("/app/land");
  revalidatePath("/app/land/grazing");
  revalidatePath(`/app/land/${fromLandUnit.id}`);
  revalidatePath(`/app/land/${toLandUnit.id}`);
  revalidatePath("/app/herd");

  return {
    success: `Moved ${selectedRows.length} ${speciesLabel}${classSuffix} from ${fromLandUnit.name} to ${toLandUnit.name}.`,
  };
}
