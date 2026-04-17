"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/context";
import { db } from "@/lib/db/client";
import {
  animalEvents,
  animalLocationAssignments,
  animals,
  type AnimalEventType,
  type AnimalStatus,
} from "@/lib/db/schema";

export interface HerdActionState {
  error?: string;
  success?: string;
}

const MAX_NEWBORN_PAIR_PHOTO_BYTES = 5 * 1024 * 1024;
const acceptedNewbornPairPhotoMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

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

const animalStatusSchema = z.enum([
  "active",
  "sold",
  "deceased",
  "culled",
  "transferred",
  "archived",
]);
const animalSpeciesSchema = z.enum(["cattle", "horse", "other"]);
const animalSexSchema = z.enum(["female", "male", "castrated_male", "unknown"]);
const lifecycleEventSchema = z.enum([
  "birth",
  "acquisition",
  "death",
  "sale_disposition",
  "cull",
  "note",
]);

const animalPayloadBaseSchema = z.object({
  internalId: z.string().trim().min(1, "Internal ID is required."),
  tagId: z.string().trim().min(1, "Tag / visual ID is required."),
  alternateId: optionalTextSchema,
  displayName: optionalTextSchema,
  species: animalSpeciesSchema,
  sex: animalSexSchema,
  animalClass: optionalTextSchema,
  breed: optionalTextSchema,
  colorMarkings: optionalTextSchema,
  birthDate: optionalDateSchema,
  isBirthDateEstimated: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  sireAnimalId: optionalUuidSchema,
  damAnimalId: optionalUuidSchema,
  acquiredOn: optionalDateSchema,
  acquisitionMethod: optionalTextSchema,
  acquisitionSource: optionalTextSchema,
  notes: optionalTextSchema,
  status: animalStatusSchema,
});

function enforceDistinctParents(
  value: { sireAnimalId?: string; damAnimalId?: string },
  ctx: z.RefinementCtx,
): void {
  if (value.sireAnimalId && value.damAnimalId && value.sireAnimalId === value.damAnimalId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["damAnimalId"],
      message: "Sire and dam cannot reference the same animal.",
    });
  }
}

const createAnimalSchema = animalPayloadBaseSchema
  .omit({ status: true })
  .superRefine(enforceDistinctParents);
const updateAnimalSchema = animalPayloadBaseSchema
  .extend({
    animalId: z.string().uuid(),
  })
  .superRefine(enforceDistinctParents);

const createEventSchema = z.object({
  animalId: z.string().uuid(),
  eventType: lifecycleEventSchema,
  occurredAt: z.preprocess(
    (value) => (value == null || value === "" ? undefined : String(value).trim()),
    z.string().optional(),
  ),
  summary: optionalTextSchema,
  details: optionalTextSchema,
});

function normalizeText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

interface NewbornPairPhotoUploadResult {
  error?: string;
  isProvided: boolean;
  dataUrl: string | null;
}

async function parseNewbornPairPhotoUpload(
  value: FormDataEntryValue | null,
): Promise<NewbornPairPhotoUploadResult> {
  if (!(value instanceof File) || value.size === 0) {
    return { isProvided: false, dataUrl: null };
  }

  const mimeType = value.type.toLowerCase();
  if (!acceptedNewbornPairPhotoMimeTypes.has(mimeType)) {
    return {
      error: "Photo must be a JPG, PNG, or WEBP image.",
      isProvided: false,
      dataUrl: null,
    };
  }

  if (value.size > MAX_NEWBORN_PAIR_PHOTO_BYTES) {
    return {
      error: "Photo must be 5 MB or smaller.",
      isProvided: false,
      dataUrl: null,
    };
  }

  const bytes = Buffer.from(await value.arrayBuffer());
  return {
    isProvided: true,
    dataUrl: `data:${mimeType};base64,${bytes.toString("base64")}`,
  };
}

function parseDateTime(value?: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function mapEventTypeToStatus(eventType: AnimalEventType): AnimalStatus | null {
  if (eventType === "birth" || eventType === "acquisition") return "active";
  if (eventType === "death") return "deceased";
  if (eventType === "sale_disposition") return "sold";
  if (eventType === "cull") return "culled";
  return null;
}

function defaultEventSummary(eventType: AnimalEventType): string {
  if (eventType === "birth") return "Birth record added.";
  if (eventType === "acquisition") return "Animal added to ranch.";
  if (eventType === "death") return "Death/loss recorded.";
  if (eventType === "sale_disposition") return "Sale/disposition recorded.";
  if (eventType === "cull") return "Cull event recorded.";
  return "Observation recorded.";
}

function isTerminalStatus(status: AnimalStatus): boolean {
  return (
    status === "sold" ||
    status === "deceased" ||
    status === "culled" ||
    status === "transferred" ||
    status === "archived"
  );
}

function isInvalidStatusTransition(current: AnimalStatus, next: AnimalStatus): boolean {
  if (current === next) return false;
  if (current === "deceased" && next !== "deceased" && next !== "archived") return true;
  return false;
}

async function validateParentReferences({
  ranchId,
  animalId,
  sireAnimalId,
  damAnimalId,
}: {
  ranchId: string;
  animalId?: string;
  sireAnimalId?: string;
  damAnimalId?: string;
}): Promise<string | null> {
  if (animalId && (sireAnimalId === animalId || damAnimalId === animalId)) {
    return "An animal cannot reference itself as sire or dam.";
  }

  const parentIds = [...new Set([sireAnimalId, damAnimalId].filter(Boolean))] as string[];
  if (!parentIds.length) return null;

  const parentRows = await db
    .select({ id: animals.id })
    .from(animals)
    .where(and(eq(animals.ranchId, ranchId), inArray(animals.id, parentIds)));

  if (parentRows.length !== parentIds.length) {
    return "Sire or dam reference is invalid for this ranch.";
  }

  return null;
}

export async function createAnimalAction(
  _prevState: HerdActionState,
  formData: FormData,
): Promise<HerdActionState> {
  const context = await requireRole(["owner", "manager"]);
  const parsed = createAnimalSchema.safeParse({
    internalId: formData.get("internalId"),
    tagId: formData.get("tagId"),
    alternateId: formData.get("alternateId"),
    displayName: formData.get("displayName"),
    species: formData.get("species"),
    sex: formData.get("sex"),
    animalClass: formData.get("animalClass"),
    breed: formData.get("breed"),
    colorMarkings: formData.get("colorMarkings"),
    birthDate: formData.get("birthDate"),
    isBirthDateEstimated: formData.get("isBirthDateEstimated"),
    sireAnimalId: formData.get("sireAnimalId"),
    damAnimalId: formData.get("damAnimalId"),
    acquiredOn: formData.get("acquiredOn"),
    acquisitionMethod: formData.get("acquisitionMethod"),
    acquisitionSource: formData.get("acquisitionSource"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid animal details." };
  }

  const parentError = await validateParentReferences({
    ranchId: context.ranch.id,
    sireAnimalId: parsed.data.sireAnimalId,
    damAnimalId: parsed.data.damAnimalId,
  });
  if (parentError) return { error: parentError };

  const newbornPairPhotoUpload = await parseNewbornPairPhotoUpload(
    formData.get("newbornPairPhoto"),
  );
  if (newbornPairPhotoUpload.error) {
    return { error: newbornPairPhotoUpload.error };
  }
  const newbornPairPhotoCapturedAt = newbornPairPhotoUpload.dataUrl ? new Date() : null;

  try {
    const [created] = await db
      .insert(animals)
      .values({
        ranchId: context.ranch.id,
        internalId: parsed.data.internalId,
        tagId: parsed.data.tagId,
        alternateId: normalizeText(parsed.data.alternateId),
        displayName: normalizeText(parsed.data.displayName),
        species: parsed.data.species,
        sex: parsed.data.sex,
        animalClass: normalizeText(parsed.data.animalClass),
        breed: normalizeText(parsed.data.breed),
        colorMarkings: normalizeText(parsed.data.colorMarkings),
        newbornPairPhotoDataUrl: newbornPairPhotoUpload.dataUrl,
        newbornPairPhotoCapturedAt,
        status: "active",
        birthDate: parsed.data.birthDate ?? null,
        isBirthDateEstimated: parsed.data.isBirthDateEstimated,
        sireAnimalId: parsed.data.sireAnimalId ?? null,
        damAnimalId: parsed.data.damAnimalId ?? null,
        acquiredOn: parsed.data.acquiredOn ?? null,
        acquisitionMethod: normalizeText(parsed.data.acquisitionMethod),
        acquisitionSource: normalizeText(parsed.data.acquisitionSource),
        notes: normalizeText(parsed.data.notes),
        isArchived: false,
        archivedAt: null,
      })
      .returning({ id: animals.id });

    await db.insert(animalEvents).values({
      ranchId: context.ranch.id,
      animalId: created.id,
      eventType: "note",
      occurredAt: new Date(),
      summary: "Animal record created.",
      details: "Initial registry entry created from herd list.",
      recordedByMembershipId: context.membership.id,
    });

    if (newbornPairPhotoCapturedAt) {
      await db.insert(animalEvents).values({
        ranchId: context.ranch.id,
        animalId: created.id,
        eventType: "note",
        occurredAt: newbornPairPhotoCapturedAt,
        summary: "Calf + mom photo captured.",
        details: "Initial calf + mom tracking photo saved.",
        recordedByMembershipId: context.membership.id,
      });
    }

    revalidatePath("/app/herd");
    return { success: "Animal created." };
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("animals_ranch_tag_uidx")
        ? "Tag / visual ID must be unique within this ranch."
        : error instanceof Error && error.message.includes("animals_ranch_internal_id_uidx")
          ? "Internal ID must be unique within this ranch."
          : "Unable to create animal.";
    return { error: message };
  }
}

export async function updateAnimalAction(
  _prevState: HerdActionState,
  formData: FormData,
): Promise<HerdActionState> {
  const context = await requireRole(["owner", "manager"]);
  const parsed = updateAnimalSchema.safeParse({
    animalId: formData.get("animalId"),
    internalId: formData.get("internalId"),
    tagId: formData.get("tagId"),
    alternateId: formData.get("alternateId"),
    displayName: formData.get("displayName"),
    species: formData.get("species"),
    sex: formData.get("sex"),
    animalClass: formData.get("animalClass"),
    breed: formData.get("breed"),
    colorMarkings: formData.get("colorMarkings"),
    birthDate: formData.get("birthDate"),
    isBirthDateEstimated: formData.get("isBirthDateEstimated"),
    sireAnimalId: formData.get("sireAnimalId"),
    damAnimalId: formData.get("damAnimalId"),
    acquiredOn: formData.get("acquiredOn"),
    acquisitionMethod: formData.get("acquisitionMethod"),
    acquisitionSource: formData.get("acquisitionSource"),
    notes: formData.get("notes"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid animal update." };
  }

  const [existing] = await db
    .select({
      id: animals.id,
      status: animals.status,
      dispositionOn: animals.dispositionOn,
      dispositionReason: animals.dispositionReason,
      newbornPairPhotoDataUrl: animals.newbornPairPhotoDataUrl,
      newbornPairPhotoCapturedAt: animals.newbornPairPhotoCapturedAt,
    })
    .from(animals)
    .where(and(eq(animals.id, parsed.data.animalId), eq(animals.ranchId, context.ranch.id)))
    .limit(1);

  if (!existing) {
    return { error: "Animal not found for this ranch." };
  }

  if (isInvalidStatusTransition(existing.status, parsed.data.status)) {
    return {
      error:
        "This status transition is blocked. Deceased records can only move to archived for data safety.",
    };
  }

  const parentError = await validateParentReferences({
    ranchId: context.ranch.id,
    animalId: parsed.data.animalId,
    sireAnimalId: parsed.data.sireAnimalId,
    damAnimalId: parsed.data.damAnimalId,
  });
  if (parentError) return { error: parentError };

  const newbornPairPhotoUpload = await parseNewbornPairPhotoUpload(
    formData.get("newbornPairPhoto"),
  );
  if (newbornPairPhotoUpload.error) {
    return { error: newbornPairPhotoUpload.error };
  }

  const removeNewbornPairPhoto = formData.get("removeNewbornPairPhoto") === "true";
  const hadExistingNewbornPairPhoto = Boolean(existing.newbornPairPhotoDataUrl);
  const newPhotoCapturedAt = newbornPairPhotoUpload.isProvided ? new Date() : null;
  const nextNewbornPairPhotoDataUrl = newbornPairPhotoUpload.isProvided
    ? newbornPairPhotoUpload.dataUrl
    : removeNewbornPairPhoto
      ? null
      : existing.newbornPairPhotoDataUrl;
  const nextNewbornPairPhotoCapturedAt = newbornPairPhotoUpload.isProvided
    ? newPhotoCapturedAt
    : removeNewbornPairPhoto
      ? null
      : existing.newbornPairPhotoCapturedAt;

  const nextStatus = parsed.data.status;
  const shouldArchive = nextStatus === "archived";
  const isTerminal =
    nextStatus === "sold" ||
    nextStatus === "deceased" ||
    nextStatus === "culled" ||
    nextStatus === "transferred";
  const hasStatusChanged = existing.status !== nextStatus;
  const nextDispositionOn = isTerminal
    ? hasStatusChanged
      ? toDateKey(new Date())
      : existing.dispositionOn
    : null;
  const nextDispositionReason = isTerminal
    ? nextStatus === "sold"
        ? hasStatusChanged
          ? "sale/disposition"
          : existing.dispositionReason
      : nextStatus === "deceased"
        ? hasStatusChanged
          ? "death/loss"
          : existing.dispositionReason
        : nextStatus === "culled"
          ? hasStatusChanged
            ? "cull"
            : existing.dispositionReason
          : hasStatusChanged
            ? "transfer"
            : existing.dispositionReason
    : null;

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(animals)
        .set({
          internalId: parsed.data.internalId,
          tagId: parsed.data.tagId,
          alternateId: normalizeText(parsed.data.alternateId),
          displayName: normalizeText(parsed.data.displayName),
          species: parsed.data.species,
          sex: parsed.data.sex,
          animalClass: normalizeText(parsed.data.animalClass),
          breed: normalizeText(parsed.data.breed),
          colorMarkings: normalizeText(parsed.data.colorMarkings),
          newbornPairPhotoDataUrl: nextNewbornPairPhotoDataUrl,
          newbornPairPhotoCapturedAt: nextNewbornPairPhotoCapturedAt,
          status: nextStatus,
          birthDate: parsed.data.birthDate ?? null,
          isBirthDateEstimated: parsed.data.isBirthDateEstimated,
          sireAnimalId: parsed.data.sireAnimalId ?? null,
          damAnimalId: parsed.data.damAnimalId ?? null,
          acquiredOn: parsed.data.acquiredOn ?? null,
          acquisitionMethod: normalizeText(parsed.data.acquisitionMethod),
          acquisitionSource: normalizeText(parsed.data.acquisitionSource),
          notes: normalizeText(parsed.data.notes),
          isArchived: shouldArchive,
          archivedAt: shouldArchive ? new Date() : null,
          dispositionOn: nextDispositionOn,
          dispositionReason: nextDispositionReason,
          updatedAt: new Date(),
        })
        .where(eq(animals.id, parsed.data.animalId));

      if (newbornPairPhotoUpload.isProvided) {
        await tx.insert(animalEvents).values({
          ranchId: context.ranch.id,
          animalId: parsed.data.animalId,
          eventType: "note",
          occurredAt: newPhotoCapturedAt ?? new Date(),
          summary: hadExistingNewbornPairPhoto
            ? "Calf + mom photo updated."
            : "Calf + mom photo captured.",
          details: hadExistingNewbornPairPhoto
            ? "Previous calf + mom tracking photo replaced with a new upload."
            : "Calf + mom tracking photo added.",
          recordedByMembershipId: context.membership.id,
        });
      } else if (removeNewbornPairPhoto && hadExistingNewbornPairPhoto) {
        await tx.insert(animalEvents).values({
          ranchId: context.ranch.id,
          animalId: parsed.data.animalId,
          eventType: "note",
          occurredAt: new Date(),
          summary: "Calf + mom photo removed.",
          details: "Calf + mom tracking photo removed from this record.",
          recordedByMembershipId: context.membership.id,
        });
      }

      if (hasStatusChanged) {
        const mappedEventType: AnimalEventType =
          nextStatus === "sold"
            ? "sale_disposition"
            : nextStatus === "deceased"
              ? "death"
              : nextStatus === "culled"
                ? "cull"
                : nextStatus === "transferred"
                  ? "sale_disposition"
                  : nextStatus === "active"
                    ? "acquisition"
                    : "note";

        await tx.insert(animalEvents).values({
          ranchId: context.ranch.id,
          animalId: parsed.data.animalId,
          eventType: mappedEventType,
          occurredAt: new Date(),
          summary: `Status changed from ${existing.status} to ${nextStatus}.`,
          details: "Status updated from animal detail form.",
          recordedByMembershipId: context.membership.id,
        });

        if (isTerminalStatus(nextStatus)) {
          await tx
            .update(animalLocationAssignments)
            .set({
              isActive: false,
              endedAt: new Date(),
            })
            .where(
              and(
                eq(animalLocationAssignments.ranchId, context.ranch.id),
                eq(animalLocationAssignments.animalId, parsed.data.animalId),
                eq(animalLocationAssignments.isActive, true),
              ),
            );
        }
      }
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("animals_ranch_tag_uidx")
        ? "Tag / visual ID must be unique within this ranch."
        : error instanceof Error && error.message.includes("animals_ranch_internal_id_uidx")
          ? "Internal ID must be unique within this ranch."
          : "Unable to update animal.";
    return { error: message };
  }

  revalidatePath("/app/herd");
  revalidatePath(`/app/herd/${parsed.data.animalId}`);
  return { success: "Animal updated." };
}

export async function createAnimalEventAction(
  _prevState: HerdActionState,
  formData: FormData,
): Promise<HerdActionState> {
  const context = await requireRole(["owner", "manager"]);
  const parsed = createEventSchema.safeParse({
    animalId: formData.get("animalId"),
    eventType: formData.get("eventType"),
    occurredAt: formData.get("occurredAt"),
    summary: formData.get("summary"),
    details: formData.get("details"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid event details." };
  }

  const [animal] = await db
    .select({
      id: animals.id,
      status: animals.status,
    })
    .from(animals)
    .where(and(eq(animals.id, parsed.data.animalId), eq(animals.ranchId, context.ranch.id)))
    .limit(1);

  if (!animal) {
    return { error: "Animal not found for this ranch." };
  }

  const occurredAt = parseDateTime(parsed.data.occurredAt) ?? new Date();
  if (parsed.data.occurredAt && !parseDateTime(parsed.data.occurredAt)) {
    return { error: "Enter a valid event date and time." };
  }

  const nextStatus = mapEventTypeToStatus(parsed.data.eventType);
  if (
    animal.status === "deceased" &&
    nextStatus &&
    nextStatus !== "deceased" &&
    nextStatus !== "archived"
  ) {
    return {
      error:
        "This animal is marked deceased. Use note events for historical context instead of reactivating status here.",
    };
  }

  await db.transaction(async (tx) => {
    await tx.insert(animalEvents).values({
      ranchId: context.ranch.id,
      animalId: animal.id,
      eventType: parsed.data.eventType,
      occurredAt,
      summary: normalizeText(parsed.data.summary) ?? defaultEventSummary(parsed.data.eventType),
      details: normalizeText(parsed.data.details),
      recordedByMembershipId: context.membership.id,
    });

    if (!nextStatus || nextStatus === animal.status) {
      return;
    }

    const statusUpdate = {
      status: nextStatus,
      isArchived: false,
      archivedAt: null,
      dispositionOn:
        nextStatus === "deceased" || nextStatus === "sold" || nextStatus === "culled"
          ? toDateKey(occurredAt)
          : null,
      dispositionReason:
        nextStatus === "deceased"
          ? "death/loss"
          : nextStatus === "sold"
            ? "sale/disposition"
            : nextStatus === "culled"
              ? "cull"
              : null,
      updatedAt: new Date(),
      ...(parsed.data.eventType === "acquisition"
        ? { acquiredOn: toDateKey(occurredAt) }
        : {}),
      ...(parsed.data.eventType === "birth"
        ? { birthDate: toDateKey(occurredAt), isBirthDateEstimated: false }
        : {}),
    };

    await tx
      .update(animals)
      .set(statusUpdate)
      .where(eq(animals.id, animal.id));

    if (isTerminalStatus(nextStatus)) {
      await tx
        .update(animalLocationAssignments)
        .set({
          isActive: false,
          endedAt: occurredAt,
        })
        .where(
          and(
            eq(animalLocationAssignments.ranchId, context.ranch.id),
            eq(animalLocationAssignments.animalId, animal.id),
            eq(animalLocationAssignments.isActive, true),
          ),
        );
    }
  });

  revalidatePath("/app/herd");
  revalidatePath(`/app/herd/${animal.id}`);
  return { success: "Event recorded." };
}
