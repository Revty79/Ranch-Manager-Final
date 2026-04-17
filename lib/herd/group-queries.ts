import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  animalGroupMemberships,
  animalGroups,
  animals,
  type AnimalGroupType,
} from "@/lib/db/schema";

export interface AnimalGroupWorkspaceGroup {
  id: string;
  name: string;
  groupType: AnimalGroupType;
  description: string | null;
  notes: string | null;
  isActive: boolean;
  memberCount: number;
  memberAnimalIds: string[];
  memberPreviewLabels: string[];
  updatedAt: Date;
}

export interface AnimalGroupWorkspace {
  groups: AnimalGroupWorkspaceGroup[];
  animalOptions: Array<{ id: string; label: string }>;
}

function formatAnimalLabel(tagId: string, displayName: string | null): string {
  return displayName ? `${displayName} (${tagId})` : tagId;
}

export async function getAnimalGroupWorkspace(ranchId: string): Promise<AnimalGroupWorkspace> {
  const [groupRows, membershipRows, animalRows] = await Promise.all([
    db
      .select({
        id: animalGroups.id,
        name: animalGroups.name,
        groupType: animalGroups.groupType,
        description: animalGroups.description,
        notes: animalGroups.notes,
        isActive: animalGroups.isActive,
        updatedAt: animalGroups.updatedAt,
      })
      .from(animalGroups)
      .where(eq(animalGroups.ranchId, ranchId))
      .orderBy(desc(animalGroups.isActive), asc(animalGroups.name)),
    db
      .select({
        groupId: animalGroupMemberships.animalGroupId,
        groupName: animalGroups.name,
        animalId: animals.id,
        tagId: animals.tagId,
        displayName: animals.displayName,
      })
      .from(animalGroupMemberships)
      .innerJoin(animalGroups, eq(animalGroupMemberships.animalGroupId, animalGroups.id))
      .innerJoin(animals, eq(animalGroupMemberships.animalId, animals.id))
      .where(
        and(
          eq(animalGroupMemberships.ranchId, ranchId),
          eq(animalGroupMemberships.isActive, true),
          eq(animals.status, "active"),
          eq(animals.isArchived, false),
        ),
      )
      .orderBy(asc(animals.displayName), asc(animals.tagId)),
    db
      .select({
        id: animals.id,
        tagId: animals.tagId,
        displayName: animals.displayName,
      })
      .from(animals)
      .where(
        and(
          eq(animals.ranchId, ranchId),
          eq(animals.status, "active"),
          eq(animals.isArchived, false),
        ),
      )
      .orderBy(asc(animals.displayName), asc(animals.tagId)),
  ]);

  const membersByGroup = new Map<
    string,
    Array<{
      animalId: string;
      label: string;
    }>
  >();
  for (const row of membershipRows) {
    const current = membersByGroup.get(row.groupId) ?? [];
    current.push({
      animalId: row.animalId,
      label: formatAnimalLabel(row.tagId, row.displayName),
    });
    membersByGroup.set(row.groupId, current);
  }

  const activeGroupByAnimal = new Map<
    string,
    { groupId: string; groupName: string | null }
  >();
  for (const row of membershipRows) {
    if (!activeGroupByAnimal.has(row.animalId)) {
      activeGroupByAnimal.set(row.animalId, {
        groupId: row.groupId,
        groupName: row.groupName,
      });
    }
  }

  return {
    groups: groupRows.map((group) => {
      const members = membersByGroup.get(group.id) ?? [];
      return {
        id: group.id,
        name: group.name,
        groupType: group.groupType,
        description: group.description,
        notes: group.notes,
        isActive: group.isActive,
        memberCount: members.length,
        memberAnimalIds: members.map((member) => member.animalId),
        memberPreviewLabels: members.slice(0, 6).map((member) => member.label),
        updatedAt: group.updatedAt,
      };
    }),
    animalOptions: animalRows.map((animal) => ({
      id: animal.id,
      label: `${formatAnimalLabel(animal.tagId, animal.displayName)}${
        activeGroupByAnimal.get(animal.id)?.groupName
          ? ` - currently in ${activeGroupByAnimal.get(animal.id)?.groupName}`
          : ""
      }`,
    })),
  };
}
