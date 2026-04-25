"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSectionManage } from "@/lib/auth/context";
import { db } from "@/lib/db/client";
import {
  animalEvents,
  animals,
  herdProtocolTemplates,
  type AnimalEventType,
} from "@/lib/db/schema";

export interface HerdRecordActionState {
  error?: string;
  success?: string;
}

const optionalTextSchema = z.preprocess(
  (value) => (value == null ? "" : String(value).trim()),
  z.string(),
);

const optionalDateSchema = z.preprocess(
  (value) => (value == null || value === "" ? undefined : String(value).trim()),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.")
    .optional(),
);

const optionalUuidSchema = z.preprocess(
  (value) => (value == null || value === "" ? undefined : String(value).trim()),
  z.string().uuid().optional(),
);

const pregnancyOutcomeSchema = z.enum(["unknown", "open", "bred", "confirmed"]);
const breedingMethodSchema = z.enum(["natural_service", "ai", "embryo_transfer", "unknown"]);
const healthRecordTypeSchema = z.enum([
  "vaccination",
  "treatment",
  "deworming",
  "injury_illness",
  "procedure_exam",
  "death_loss_note",
]);
const protocolTypeSchema = z.enum([
  "vaccination",
  "deworming",
  "pregnancy_check",
  "pre_breeding",
  "pre_birth_planning",
]);

const breedingRecordSchema = z
  .object({
    animalId: z.string().uuid(),
    serviceDate: optionalDateSchema,
    serviceWindowStart: optionalDateSchema,
    serviceWindowEnd: optionalDateSchema,
    sireAnimalId: optionalUuidSchema,
    breedingMethod: breedingMethodSchema.default("natural_service"),
    outcome: pregnancyOutcomeSchema.default("bred"),
    expectedBirthDate: optionalDateSchema,
    offspringAnimalId: optionalUuidSchema,
    notes: optionalTextSchema,
  })
  .superRefine((value, ctx) => {
    if (!value.serviceDate && !value.serviceWindowStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["serviceDate"],
        message: "Provide a service date or service-window start.",
      });
    }

    if (value.serviceWindowStart && value.serviceWindowEnd && value.serviceWindowEnd < value.serviceWindowStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["serviceWindowEnd"],
        message: "Service-window end cannot be before start.",
      });
    }

    if (value.offspringAnimalId && !value.expectedBirthDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expectedBirthDate"],
        message: "When linking offspring, add expected/actual birth date context.",
      });
    }
  });

const pregnancyCheckSchema = z.object({
  animalId: z.string().uuid(),
  checkDate: optionalDateSchema,
  outcome: pregnancyOutcomeSchema,
  expectedBirthDate: optionalDateSchema,
  notes: optionalTextSchema,
});

const healthRecordSchema = z.object({
  animalId: z.string().uuid(),
  healthRecordType: healthRecordTypeSchema,
  recordDate: optionalDateSchema,
  productOrProcedure: z.string().trim().min(2, "Product/procedure summary is required."),
  lotSerial: optionalTextSchema,
  withdrawalNote: optionalTextSchema,
  notes: optionalTextSchema,
});

const createProtocolSchema = z.object({
  name: z.string().trim().min(2, "Template name is required."),
  protocolType: protocolTypeSchema,
  species: z
    .enum(["all", "cattle", "horse", "other"])
    .default("all"),
  sex: z
    .enum(["all", "female", "male", "castrated_male", "unknown"])
    .default("all"),
  intervalDays: z.coerce.number().int().min(1, "Interval must be at least 1 day.").max(3650),
  dueSoonDays: z.coerce.number().int().min(0, "Due-soon threshold cannot be negative.").max(365),
  notes: optionalTextSchema,
});

const toggleProtocolSchema = z.object({
  templateId: z.string().uuid(),
  setActive: z.enum(["true", "false"]),
});

function parseDateToTimestamp(value?: string): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function ensureAnimalInRanch(ranchId: string, animalId: string) {
  const [animal] = await db
    .select({ id: animals.id, tagId: animals.tagId, displayName: animals.displayName })
    .from(animals)
    .where(and(eq(animals.ranchId, ranchId), eq(animals.id, animalId)))
    .limit(1);

  return animal ?? null;
}

function healthEventTypeFor(recordType: z.infer<typeof healthRecordTypeSchema>): AnimalEventType {
  if (recordType === "vaccination") return "vaccination";
  if (recordType === "treatment") return "treatment";
  if (recordType === "deworming") return "deworming";
  return "note";
}

function healthLabel(recordType: z.infer<typeof healthRecordTypeSchema>): string {
  if (recordType === "vaccination") return "Vaccination";
  if (recordType === "treatment") return "Treatment";
  if (recordType === "deworming") return "Deworming";
  if (recordType === "injury_illness") return "Injury/illness";
  if (recordType === "procedure_exam") return "Procedure/exam";
  return "Death/loss health note";
}

export async function recordBreedingEventAction(
  _prevState: HerdRecordActionState,
  formData: FormData,
): Promise<HerdRecordActionState> {
  const context = await requireSectionManage("herd");
  const parsed = breedingRecordSchema.safeParse({
    animalId: formData.get("animalId"),
    serviceDate: formData.get("serviceDate"),
    serviceWindowStart: formData.get("serviceWindowStart"),
    serviceWindowEnd: formData.get("serviceWindowEnd"),
    sireAnimalId: formData.get("sireAnimalId"),
    breedingMethod: formData.get("breedingMethod"),
    outcome: formData.get("outcome"),
    expectedBirthDate: formData.get("expectedBirthDate"),
    offspringAnimalId: formData.get("offspringAnimalId"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid breeding record." };
  }

  const [animal, sire, offspring] = await Promise.all([
    ensureAnimalInRanch(context.ranch.id, parsed.data.animalId),
    parsed.data.sireAnimalId
      ? ensureAnimalInRanch(context.ranch.id, parsed.data.sireAnimalId)
      : Promise.resolve(null),
    parsed.data.offspringAnimalId
      ? ensureAnimalInRanch(context.ranch.id, parsed.data.offspringAnimalId)
      : Promise.resolve(null),
  ]);

  if (!animal) return { error: "Animal not found for this ranch." };
  if (parsed.data.sireAnimalId && !sire) return { error: "Selected sire is not in this ranch." };
  if (parsed.data.offspringAnimalId && !offspring) {
    return { error: "Selected offspring is not in this ranch." };
  }
  if (parsed.data.offspringAnimalId === parsed.data.animalId) {
    return { error: "Offspring linkage cannot reference the same animal." };
  }

  const occurredAt =
    parseDateToTimestamp(parsed.data.serviceDate) ??
    parseDateToTimestamp(parsed.data.serviceWindowStart) ??
    new Date();

  const summary = [
    "Breeding/service recorded",
    sire ? `sire: ${sire.tagId}` : null,
    `outcome: ${parsed.data.outcome}`,
  ]
    .filter(Boolean)
    .join(" · ");

  await db.insert(animalEvents).values({
    ranchId: context.ranch.id,
    animalId: animal.id,
    eventType: "breeding",
    occurredAt,
    summary,
    details: normalizeText(parsed.data.notes),
    eventData: {
      serviceDate: parsed.data.serviceDate ?? null,
      serviceWindowStart: parsed.data.serviceWindowStart ?? null,
      serviceWindowEnd: parsed.data.serviceWindowEnd ?? null,
      breedingMethod: parsed.data.breedingMethod,
      outcome: parsed.data.outcome,
      expectedBirthDate: parsed.data.expectedBirthDate ?? null,
      sireAnimalId: parsed.data.sireAnimalId ?? null,
      offspringAnimalId: parsed.data.offspringAnimalId ?? null,
    },
    recordedByMembershipId: context.membership.id,
  });

  revalidatePath("/app/herd");
  revalidatePath("/app/herd/breeding");
  revalidatePath(`/app/herd/${animal.id}`);
  return { success: "Breeding record saved." };
}

export async function recordPregnancyCheckAction(
  _prevState: HerdRecordActionState,
  formData: FormData,
): Promise<HerdRecordActionState> {
  const context = await requireSectionManage("herd");
  const parsed = pregnancyCheckSchema.safeParse({
    animalId: formData.get("animalId"),
    checkDate: formData.get("checkDate"),
    outcome: formData.get("outcome"),
    expectedBirthDate: formData.get("expectedBirthDate"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid pregnancy check." };
  }

  const animal = await ensureAnimalInRanch(context.ranch.id, parsed.data.animalId);
  if (!animal) return { error: "Animal not found for this ranch." };

  const occurredAt = parseDateToTimestamp(parsed.data.checkDate) ?? new Date();

  await db.insert(animalEvents).values({
    ranchId: context.ranch.id,
    animalId: animal.id,
    eventType: "pregnancy_check",
    occurredAt,
    summary: `Pregnancy check: ${parsed.data.outcome}.`,
    details: normalizeText(parsed.data.notes),
    eventData: {
      outcome: parsed.data.outcome,
      expectedBirthDate: parsed.data.expectedBirthDate ?? null,
    },
    recordedByMembershipId: context.membership.id,
  });

  revalidatePath("/app/herd");
  revalidatePath("/app/herd/breeding");
  revalidatePath(`/app/herd/${animal.id}`);
  return { success: "Pregnancy check recorded." };
}

export async function recordHealthEventAction(
  _prevState: HerdRecordActionState,
  formData: FormData,
): Promise<HerdRecordActionState> {
  const context = await requireSectionManage("herd");
  const parsed = healthRecordSchema.safeParse({
    animalId: formData.get("animalId"),
    healthRecordType: formData.get("healthRecordType"),
    recordDate: formData.get("recordDate"),
    productOrProcedure: formData.get("productOrProcedure"),
    lotSerial: formData.get("lotSerial"),
    withdrawalNote: formData.get("withdrawalNote"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid health record." };
  }

  const animal = await ensureAnimalInRanch(context.ranch.id, parsed.data.animalId);
  if (!animal) return { error: "Animal not found for this ranch." };

  const eventType = healthEventTypeFor(parsed.data.healthRecordType);
  const occurredAt = parseDateToTimestamp(parsed.data.recordDate) ?? new Date();
  const label = healthLabel(parsed.data.healthRecordType);

  await db.insert(animalEvents).values({
    ranchId: context.ranch.id,
    animalId: animal.id,
    eventType,
    occurredAt,
    summary: `${label}: ${parsed.data.productOrProcedure}`,
    details: normalizeText(parsed.data.notes),
    eventData: {
      healthRecordType: parsed.data.healthRecordType,
      productOrProcedure: parsed.data.productOrProcedure,
      lotSerial: normalizeText(parsed.data.lotSerial),
      withdrawalNote: normalizeText(parsed.data.withdrawalNote),
    },
    recordedByMembershipId: context.membership.id,
  });

  revalidatePath("/app/herd");
  revalidatePath("/app/herd/breeding");
  revalidatePath(`/app/herd/${animal.id}`);
  return { success: "Health record saved." };
}

export async function createProtocolTemplateAction(
  _prevState: HerdRecordActionState,
  formData: FormData,
): Promise<HerdRecordActionState> {
  const context = await requireSectionManage("herd");
  const parsed = createProtocolSchema.safeParse({
    name: formData.get("name"),
    protocolType: formData.get("protocolType"),
    species: formData.get("species"),
    sex: formData.get("sex"),
    intervalDays: formData.get("intervalDays"),
    dueSoonDays: formData.get("dueSoonDays"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid protocol template." };
  }

  await db.insert(herdProtocolTemplates).values({
    ranchId: context.ranch.id,
    name: parsed.data.name,
    protocolType: parsed.data.protocolType,
    species: parsed.data.species === "all" ? null : parsed.data.species,
    sex: parsed.data.sex === "all" ? null : parsed.data.sex,
    intervalDays: parsed.data.intervalDays,
    dueSoonDays: parsed.data.dueSoonDays,
    notes: normalizeText(parsed.data.notes),
    isActive: true,
  });

  revalidatePath("/app/herd");
  revalidatePath("/app/herd/breeding");
  return { success: "Protocol template created." };
}

export async function toggleProtocolTemplateActiveAction(
  _prevState: HerdRecordActionState,
  formData: FormData,
): Promise<HerdRecordActionState> {
  const context = await requireSectionManage("herd");
  const parsed = toggleProtocolSchema.safeParse({
    templateId: formData.get("templateId"),
    setActive: formData.get("setActive"),
  });

  if (!parsed.success) {
    return { error: "Invalid protocol toggle request." };
  }

  const [template] = await db
    .select({ id: herdProtocolTemplates.id })
    .from(herdProtocolTemplates)
    .where(
      and(
        eq(herdProtocolTemplates.id, parsed.data.templateId),
        eq(herdProtocolTemplates.ranchId, context.ranch.id),
      ),
    )
    .limit(1);

  if (!template) {
    return { error: "Protocol template not found for this ranch." };
  }

  await db
    .update(herdProtocolTemplates)
    .set({
      isActive: parsed.data.setActive === "true",
      updatedAt: new Date(),
    })
    .where(eq(herdProtocolTemplates.id, parsed.data.templateId));

  revalidatePath("/app/herd");
  revalidatePath("/app/herd/breeding");
  return { success: parsed.data.setActive === "true" ? "Template activated." : "Template paused." };
}
