"use server";

import { and, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/context";
import { db } from "@/lib/db/client";
import {
  animalEvents,
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

const optionalUuidSchema = z.preprocess(
  (value) => (value == null || value === "" ? undefined : String(value).trim()),
  z.string().uuid().optional(),
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

const deleteAnimalGroupSchema = z.object({
  animalGroupId: z.string().uuid(),
  reassignmentAnimalGroupId: optionalUuidSchema,
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
      isActive: animalGroups.isActive,
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

  if (!group.isActive) {
    return { error: "This herd group is paused. Activate it before editing membership." };
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

  const conflictingMemberships = desiredAnimalIds.length
    ? await db
        .select({
          id: animalGroupMemberships.id,
          animalId: animalGroupMemberships.animalId,
          fromGroupId: animalGroupMemberships.animalGroupId,
          fromGroupName: animalGroups.name,
        })
        .from(animalGroupMemberships)
        .innerJoin(animalGroups, eq(animalGroupMemberships.animalGroupId, animalGroups.id))
        .where(
          and(
            eq(animalGroupMemberships.ranchId, context.ranch.id),
            eq(animalGroupMemberships.isActive, true),
            inArray(animalGroupMemberships.animalId, desiredAnimalIds),
            ne(animalGroupMemberships.animalGroupId, parsed.data.animalGroupId),
          ),
        )
    : [];

  const existingAnimalIdSet = new Set(existingMemberships.map((row) => row.animalId));
  const desiredAnimalIdSet = new Set(desiredAnimalIds);
  const membershipIdsToDeactivate = existingMemberships
    .filter((row) => !desiredAnimalIdSet.has(row.animalId))
    .map((row) => row.id);
  const removedAnimalIds = existingMemberships
    .filter((row) => !desiredAnimalIdSet.has(row.animalId))
    .map((row) => row.animalId);
  const animalIdsToInsert = desiredAnimalIds.filter(
    (animalId) => !existingAnimalIdSet.has(animalId),
  );

  const conflictingMembershipIds = conflictingMemberships.map((row) => row.id);
  const movedFromByAnimalId = new Map<
    string,
    { fromGroupId: string; fromGroupName: string | null }
  >();
  for (const row of conflictingMemberships) {
    if (!movedFromByAnimalId.has(row.animalId)) {
      movedFromByAnimalId.set(row.animalId, {
        fromGroupId: row.fromGroupId,
        fromGroupName: row.fromGroupName,
      });
    }
  }
  const movedAnimalIds = animalIdsToInsert.filter((animalId) =>
    movedFromByAnimalId.has(animalId),
  );
  const newlyAssignedAnimalIds = animalIdsToInsert.filter(
    (animalId) => !movedFromByAnimalId.has(animalId),
  );

  const now = new Date();

  await db.transaction(async (tx) => {
    if (membershipIdsToDeactivate.length) {
      await tx
        .update(animalGroupMemberships)
        .set({
          isActive: false,
          leftAt: now,
          membershipNote: `Removed from ${group.name} by membership update.`,
        })
        .where(inArray(animalGroupMemberships.id, membershipIdsToDeactivate));
    }

    if (conflictingMembershipIds.length) {
      await tx
        .update(animalGroupMemberships)
        .set({
          isActive: false,
          leftAt: now,
          membershipNote: `Moved into ${group.name} by membership update.`,
        })
        .where(inArray(animalGroupMemberships.id, conflictingMembershipIds));
    }

    if (animalIdsToInsert.length) {
      await tx.insert(animalGroupMemberships).values(
        animalIdsToInsert.map((animalId) => ({
          ranchId: context.ranch.id,
          animalGroupId: parsed.data.animalGroupId,
          animalId,
          joinedAt: now,
          isActive: true,
          leftAt: null,
          membershipNote: movedFromByAnimalId.has(animalId)
            ? `Moved into ${group.name}.`
            : `Added to ${group.name}.`,
        })),
      );
    }

    const eventRows = [
      ...removedAnimalIds.map((animalId) => ({
        ranchId: context.ranch.id,
        animalId,
        animalGroupId: null,
        eventType: "note" as const,
        occurredAt: now,
        summary: `Removed from herd group ${group.name}.`,
        details: "Membership removed in herd-group manager.",
        eventData: {
          herdGroupAction: "removed",
          fromGroupId: group.id,
          fromGroupName: group.name,
        },
        recordedByMembershipId: context.membership.id,
      })),
      ...movedAnimalIds.map((animalId) => {
        const from = movedFromByAnimalId.get(animalId);
        return {
          ranchId: context.ranch.id,
          animalId,
          animalGroupId: group.id,
          eventType: "note" as const,
          occurredAt: now,
          summary: `Herd group changed to ${group.name}.`,
          details: `Moved from ${from?.fromGroupName ?? "another group"} to ${group.name}.`,
          eventData: {
            herdGroupAction: "moved",
            fromGroupId: from?.fromGroupId ?? null,
            fromGroupName: from?.fromGroupName ?? null,
            toGroupId: group.id,
            toGroupName: group.name,
          },
          recordedByMembershipId: context.membership.id,
        };
      }),
      ...newlyAssignedAnimalIds.map((animalId) => ({
        ranchId: context.ranch.id,
        animalId,
        animalGroupId: group.id,
        eventType: "note" as const,
        occurredAt: now,
        summary: `Added to herd group ${group.name}.`,
        details: "Membership created in herd-group manager.",
        eventData: {
          herdGroupAction: "added",
          toGroupId: group.id,
          toGroupName: group.name,
        },
        recordedByMembershipId: context.membership.id,
      })),
    ];

    if (eventRows.length) {
      await tx.insert(animalEvents).values(eventRows);
    }
  });

  revalidateGroupSurfaces();
  return {
    success:
      `Saved ${desiredAnimalIds.length} active members for ${group.name}. ` +
      `${movedAnimalIds.length} moved from other groups, ` +
      `${removedAnimalIds.length} removed.`,
  };
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

export async function deleteAnimalGroupAction(
  _prevState: HerdGroupActionState,
  formData: FormData,
): Promise<HerdGroupActionState> {
  const context = await requireRole(["owner", "manager"]);
  const parsed = deleteAnimalGroupSchema.safeParse({
    animalGroupId: formData.get("animalGroupId"),
    reassignmentAnimalGroupId: formData.get("reassignmentAnimalGroupId"),
  });

  if (!parsed.success) {
    return { error: "Invalid herd-group deletion request." };
  }

  const [sourceGroup] = await db
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

  if (!sourceGroup) {
    return { error: "Herd group not found for this ranch." };
  }

  if (parsed.data.reassignmentAnimalGroupId === sourceGroup.id) {
    return { error: "Choose a different destination group for reassignment." };
  }

  const targetGroup = parsed.data.reassignmentAnimalGroupId
    ? (
        await db
          .select({
            id: animalGroups.id,
            name: animalGroups.name,
            isActive: animalGroups.isActive,
          })
          .from(animalGroups)
          .where(
            and(
              eq(animalGroups.id, parsed.data.reassignmentAnimalGroupId),
              eq(animalGroups.ranchId, context.ranch.id),
            ),
          )
          .limit(1)
      )[0] ?? null
    : null;

  if (parsed.data.reassignmentAnimalGroupId && !targetGroup) {
    return { error: "Destination herd group not found for this ranch." };
  }

  if (targetGroup && !targetGroup.isActive) {
    return { error: "Destination herd group is paused. Activate it before reassignment." };
  }

  const activeMemberships = await db
    .select({
      id: animalGroupMemberships.id,
      animalId: animalGroupMemberships.animalId,
    })
    .from(animalGroupMemberships)
    .where(
      and(
        eq(animalGroupMemberships.ranchId, context.ranch.id),
        eq(animalGroupMemberships.animalGroupId, sourceGroup.id),
        eq(animalGroupMemberships.isActive, true),
      ),
    );

  const now = new Date();
  const activeAnimalIds = activeMemberships.map((row) => row.animalId);

  await db.transaction(async (tx) => {
    if (activeMemberships.length) {
      await tx
        .update(animalGroupMemberships)
        .set({
          isActive: false,
          leftAt: now,
          membershipNote: targetGroup
            ? `Moved due to deletion of ${sourceGroup.name}; reassigned to ${targetGroup.name}.`
            : `Removed due to deletion of ${sourceGroup.name}.`,
        })
        .where(inArray(animalGroupMemberships.id, activeMemberships.map((row) => row.id)));
    }

    if (targetGroup && activeAnimalIds.length) {
      const alreadyInTargetRows = await tx
        .select({
          animalId: animalGroupMemberships.animalId,
        })
        .from(animalGroupMemberships)
        .where(
          and(
            eq(animalGroupMemberships.ranchId, context.ranch.id),
            eq(animalGroupMemberships.animalGroupId, targetGroup.id),
            eq(animalGroupMemberships.isActive, true),
            inArray(animalGroupMemberships.animalId, activeAnimalIds),
          ),
        );
      const alreadyInTarget = new Set(alreadyInTargetRows.map((row) => row.animalId));
      const animalIdsToInsert = activeAnimalIds.filter((animalId) => !alreadyInTarget.has(animalId));

      if (animalIdsToInsert.length) {
        await tx.insert(animalGroupMemberships).values(
          animalIdsToInsert.map((animalId) => ({
            ranchId: context.ranch.id,
            animalGroupId: targetGroup.id,
            animalId,
            joinedAt: now,
            isActive: true,
            leftAt: null,
            membershipNote: `Moved from deleted group ${sourceGroup.name}.`,
          })),
        );
      }
    }

    if (activeAnimalIds.length) {
      await tx.insert(animalEvents).values(
        activeAnimalIds.map((animalId) => ({
          ranchId: context.ranch.id,
          animalId,
          animalGroupId: targetGroup?.id ?? null,
          eventType: "note" as const,
          occurredAt: now,
          summary: targetGroup
            ? `Herd group moved from ${sourceGroup.name} to ${targetGroup.name}.`
            : `Removed from herd group ${sourceGroup.name}.`,
          details: targetGroup
            ? `Source group ${sourceGroup.name} was deleted and membership was reassigned.`
            : `Group ${sourceGroup.name} was deleted with no reassignment selected.`,
          eventData: {
            herdGroupAction: targetGroup ? "group_deleted_reassigned" : "group_deleted_removed",
            fromGroupId: sourceGroup.id,
            fromGroupName: sourceGroup.name,
            toGroupId: targetGroup?.id ?? null,
            toGroupName: targetGroup?.name ?? null,
          },
          recordedByMembershipId: context.membership.id,
        })),
      );
    }

    await tx.delete(animalGroups).where(eq(animalGroups.id, sourceGroup.id));
  });

  revalidateGroupSurfaces();
  return {
    success: targetGroup
      ? `Deleted ${sourceGroup.name}. Reassigned ${activeAnimalIds.length} animals to ${targetGroup.name}.`
      : `Deleted ${sourceGroup.name}. ${activeAnimalIds.length} animals were removed from that herd group.`,
  };
}

