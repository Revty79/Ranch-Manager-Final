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
} from "@/lib/db/schema";

export interface HerdGroupActionState {
  error?: string;
  success?: string;
}

const optionalTextSchema = z.preprocess(
  (value) => (value == null ? "" : String(value).trim()),
  z.string(),
);

const animalGroupTypeSchema = z.enum([
  "management",
  "breeding",
  "health",
  "marketing",
  "custom",
] as const);

const createAnimalGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required."),
  groupType: animalGroupTypeSchema.default("management"),
  description: optionalTextSchema,
  notes: optionalTextSchema,
});

const setAnimalGroupMembersSchema = z.object({
  animalGroupId: z.string().uuid(),
  animalIds: z.array(z.string().uuid()).default([]),
});

const toggleAnimalGroupSchema = z.object({
  animalGroupId: z.string().uuid(),
  nextIsActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true"),
});

function normalizeText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function revalidateGroupSurfaces() {
  revalidatePath("/app/herd");
  revalidatePath("/app/land");
  revalidatePath("/app/land/grazing");
}

export async function createAnimalGroupAction(
  _prevState: HerdGroupActionState,
  formData: FormData,
): Promise<HerdGroupActionState> {
  const context = await requireRole(["owner", "manager"]);
  const parsed = createAnimalGroupSchema.safeParse({
    name: formData.get("name"),
    groupType: formData.get("groupType"),
    description: formData.get("description"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid herd group details." };
  }

  try {
    await db.insert(animalGroups).values({
      ranchId: context.ranch.id,
      name: parsed.data.name,
      groupType: parsed.data.groupType,
      description: normalizeText(parsed.data.description),
      notes: normalizeText(parsed.data.notes),
      isActive: true,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("animal_groups_ranch_name_uidx")
        ? "A herd group with this name already exists."
        : "Unable to create herd group.";
    return { error: message };
  }

  revalidateGroupSurfaces();
  return { success: "Herd group created." };
}

export async function setAnimalGroupMembersAction(
  _prevState: HerdGroupActionState,
  formData: FormData,
): Promise<HerdGroupActionState> {
  const context = await requireRole(["owner", "manager"]);
  const parsed = setAnimalGroupMembersSchema.safeParse({
    animalGroupId: formData.get("animalGroupId"),
    animalIds: formData.getAll("animalIds").map((value) => String(value)),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid herd member selection." };
  }

  const desiredAnimalIds = [...new Set(parsed.data.animalIds)];
  const [group] = await db
    .select({
      id: animalGroups.id,
      name: animalGroups.name,
    })
    .from(animalGroups)
    .where(
      and(
        eq(animalGroups.id, parsed.data.animalGroupId),
        eq(animalGroups.ranchId, context.ranch.id),
      ),
    )
    .limit(1);

  if (!group) {
    return { error: "Herd group not found for this ranch." };
  }

  if (desiredAnimalIds.length) {
    const validAnimals = await db
      .select({ id: animals.id })
      .from(animals)
      .where(
        and(
          eq(animals.ranchId, context.ranch.id),
          eq(animals.status, "active"),
          eq(animals.isArchived, false),
          inArray(animals.id, desiredAnimalIds),
        ),
      );

    if (validAnimals.length !== desiredAnimalIds.length) {
      return { error: "One or more selected animals are not active in this ranch." };
    }
  }

  const existingMemberships = await db
    .select({
      id: animalGroupMemberships.id,
      animalId: animalGroupMemberships.animalId,
    })
    .from(animalGroupMemberships)
    .where(
      and(
        eq(animalGroupMemberships.ranchId, context.ranch.id),
        eq(animalGroupMemberships.animalGroupId, parsed.data.animalGroupId),
        eq(animalGroupMemberships.isActive, true),
      ),
    );

  const existingAnimalIdSet = new Set(existingMemberships.map((row) => row.animalId));
  const desiredAnimalIdSet = new Set(desiredAnimalIds);
  const membershipIdsToDeactivate = existingMemberships
    .filter((row) => !desiredAnimalIdSet.has(row.animalId))
    .map((row) => row.id);
  const animalIdsToInsert = desiredAnimalIds.filter(
    (animalId) => !existingAnimalIdSet.has(animalId),
  );

  await db.transaction(async (tx) => {
    if (membershipIdsToDeactivate.length) {
      await tx
        .update(animalGroupMemberships)
        .set({
          isActive: false,
          leftAt: new Date(),
        })
        .where(inArray(animalGroupMemberships.id, membershipIdsToDeactivate));
    }

    if (animalIdsToInsert.length) {
      await tx.insert(animalGroupMemberships).values(
        animalIdsToInsert.map((animalId) => ({
          ranchId: context.ranch.id,
          animalGroupId: parsed.data.animalGroupId,
          animalId,
          joinedAt: new Date(),
          isActive: true,
          leftAt: null,
        })),
      );
    }
  });

  revalidateGroupSurfaces();
  return { success: `Saved ${desiredAnimalIds.length} active members for ${group.name}.` };
}

export async function toggleAnimalGroupActiveAction(
  _prevState: HerdGroupActionState,
  formData: FormData,
): Promise<HerdGroupActionState> {
  const context = await requireRole(["owner", "manager"]);
  const parsed = toggleAnimalGroupSchema.safeParse({
    animalGroupId: formData.get("animalGroupId"),
    nextIsActive: formData.get("nextIsActive"),
  });

  if (!parsed.success) {
    return { error: "Invalid herd-group status update." };
  }

  const [group] = await db
    .select({
      id: animalGroups.id,
      name: animalGroups.name,
    })
    .from(animalGroups)
    .where(
      and(
        eq(animalGroups.id, parsed.data.animalGroupId),
        eq(animalGroups.ranchId, context.ranch.id),
      ),
    )
    .limit(1);

  if (!group) {
    return { error: "Herd group not found for this ranch." };
  }

  await db
    .update(animalGroups)
    .set({
      isActive: parsed.data.nextIsActive,
      updatedAt: new Date(),
    })
    .where(eq(animalGroups.id, parsed.data.animalGroupId));

  revalidateGroupSurfaces();
  return {
    success: parsed.data.nextIsActive
      ? `Activated ${group.name}.`
      : `Paused ${group.name}.`,
  };
}
