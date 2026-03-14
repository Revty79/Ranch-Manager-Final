import { and, asc, desc, eq, inArray, max } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  animalEvents,
  animals,
  herdProtocolTemplates,
  type AnimalEventType,
  type AnimalSex,
  type AnimalSpecies,
  type HerdProtocolType,
} from "@/lib/db/schema";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const protocolEventMap: Record<HerdProtocolType, AnimalEventType> = {
  vaccination: "vaccination",
  deworming: "deworming",
  pregnancy_check: "pregnancy_check",
  pre_breeding: "breeding",
  pre_birth_planning: "breeding",
};

export interface HerdProtocolTemplateRow {
  id: string;
  name: string;
  protocolType: HerdProtocolType;
  species: AnimalSpecies | null;
  sex: AnimalSex | null;
  intervalDays: number;
  dueSoonDays: number;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getProtocolTemplatesForRanch(
  ranchId: string,
): Promise<HerdProtocolTemplateRow[]> {
  return db
    .select({
      id: herdProtocolTemplates.id,
      name: herdProtocolTemplates.name,
      protocolType: herdProtocolTemplates.protocolType,
      species: herdProtocolTemplates.species,
      sex: herdProtocolTemplates.sex,
      intervalDays: herdProtocolTemplates.intervalDays,
      dueSoonDays: herdProtocolTemplates.dueSoonDays,
      isActive: herdProtocolTemplates.isActive,
      notes: herdProtocolTemplates.notes,
      createdAt: herdProtocolTemplates.createdAt,
      updatedAt: herdProtocolTemplates.updatedAt,
    })
    .from(herdProtocolTemplates)
    .where(eq(herdProtocolTemplates.ranchId, ranchId))
    .orderBy(asc(herdProtocolTemplates.isActive), asc(herdProtocolTemplates.name));
}

export interface ProtocolDueItem {
  protocolId: string;
  protocolName: string;
  protocolType: HerdProtocolType;
  animalId: string;
  animalTagId: string;
  animalDisplayName: string | null;
  species: AnimalSpecies;
  sex: AnimalSex;
  lastEventAt: Date | null;
  dueAt: Date;
  dueState: "overdue" | "due_soon" | "upcoming";
  daysUntilDue: number;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function templateAppliesToAnimal(
  template: HerdProtocolTemplateRow,
  animal: {
    species: AnimalSpecies;
    sex: AnimalSex;
  },
): boolean {
  const speciesMatches = template.species ? template.species === animal.species : true;
  const explicitSexMatch = template.sex ? template.sex === animal.sex : true;
  const reproductiveTemplateWithoutSex =
    !template.sex &&
    (template.protocolType === "pregnancy_check" ||
      template.protocolType === "pre_breeding" ||
      template.protocolType === "pre_birth_planning");
  const inferredSexMatch = reproductiveTemplateWithoutSex
    ? animal.sex === "female"
    : true;

  return speciesMatches && explicitSexMatch && inferredSexMatch;
}

export async function getProtocolDueItemsForRanch(
  ranchId: string,
  options?: { limit?: number },
): Promise<ProtocolDueItem[]> {
  const [templates, animalRows] = await Promise.all([
    db
      .select({
        id: herdProtocolTemplates.id,
        name: herdProtocolTemplates.name,
        protocolType: herdProtocolTemplates.protocolType,
        species: herdProtocolTemplates.species,
        sex: herdProtocolTemplates.sex,
        intervalDays: herdProtocolTemplates.intervalDays,
        dueSoonDays: herdProtocolTemplates.dueSoonDays,
        isActive: herdProtocolTemplates.isActive,
        notes: herdProtocolTemplates.notes,
        createdAt: herdProtocolTemplates.createdAt,
        updatedAt: herdProtocolTemplates.updatedAt,
      })
      .from(herdProtocolTemplates)
      .where(
        and(
          eq(herdProtocolTemplates.ranchId, ranchId),
          eq(herdProtocolTemplates.isActive, true),
        ),
      ),
    db
      .select({
        id: animals.id,
        tagId: animals.tagId,
        displayName: animals.displayName,
        species: animals.species,
        sex: animals.sex,
      })
      .from(animals)
      .where(
        and(
          eq(animals.ranchId, ranchId),
          eq(animals.status, "active"),
          eq(animals.isArchived, false),
        ),
      ),
  ]);

  if (!templates.length || !animalRows.length) {
    return [];
  }

  const requiredEventTypes = [...new Set(templates.map((template) => protocolEventMap[template.protocolType]))];

  const latestEventRows = await db
    .select({
      animalId: animalEvents.animalId,
      eventType: animalEvents.eventType,
      latestOccurredAt: max(animalEvents.occurredAt),
    })
    .from(animalEvents)
    .where(
      and(
        eq(animalEvents.ranchId, ranchId),
        inArray(animalEvents.eventType, requiredEventTypes),
      ),
    )
    .groupBy(animalEvents.animalId, animalEvents.eventType);

  const lastEventMap = new Map<string, Date>();
  for (const row of latestEventRows) {
    if (!row.latestOccurredAt) continue;
    lastEventMap.set(`${row.animalId}:${row.eventType}`, row.latestOccurredAt);
  }

  const today = startOfDay(new Date());
  const dueItems: ProtocolDueItem[] = [];

  for (const template of templates) {
    const eventType = protocolEventMap[template.protocolType];
    for (const animal of animalRows) {
      if (!templateAppliesToAnimal(template, animal)) continue;

      const lastEventAt = lastEventMap.get(`${animal.id}:${eventType}`) ?? null;
      const dueAt = lastEventAt
        ? new Date(lastEventAt.getTime() + template.intervalDays * MS_PER_DAY)
        : today;
      const dueDateStart = startOfDay(dueAt);
      const daysUntilDue = Math.floor((dueDateStart.getTime() - today.getTime()) / MS_PER_DAY);
      const dueState =
        daysUntilDue < 0
          ? "overdue"
          : daysUntilDue <= template.dueSoonDays
            ? "due_soon"
            : "upcoming";

      dueItems.push({
        protocolId: template.id,
        protocolName: template.name,
        protocolType: template.protocolType,
        animalId: animal.id,
        animalTagId: animal.tagId,
        animalDisplayName: animal.displayName,
        species: animal.species,
        sex: animal.sex,
        lastEventAt,
        dueAt,
        dueState,
        daysUntilDue,
      });
    }
  }

  const sorted = dueItems.sort((a, b) => {
    if (a.daysUntilDue !== b.daysUntilDue) return a.daysUntilDue - b.daysUntilDue;
    return a.dueAt.getTime() - b.dueAt.getTime();
  });

  if (!options?.limit) return sorted;
  return sorted.slice(0, options.limit);
}

export interface HerdActivityRow {
  id: string;
  animalId: string;
  animalTagId: string;
  animalDisplayName: string | null;
  eventType: AnimalEventType;
  occurredAt: Date;
  summary: string;
}

export async function getRecentBreedingActivity(
  ranchId: string,
  limit = 15,
): Promise<HerdActivityRow[]> {
  return db
    .select({
      id: animalEvents.id,
      animalId: animalEvents.animalId,
      animalTagId: animals.tagId,
      animalDisplayName: animals.displayName,
      eventType: animalEvents.eventType,
      occurredAt: animalEvents.occurredAt,
      summary: animalEvents.summary,
    })
    .from(animalEvents)
    .innerJoin(animals, eq(animalEvents.animalId, animals.id))
    .where(
      and(
        eq(animalEvents.ranchId, ranchId),
        inArray(animalEvents.eventType, ["breeding", "pregnancy_check"]),
      ),
    )
    .orderBy(desc(animalEvents.occurredAt))
    .limit(limit);
}

export async function getRecentHealthActivity(
  ranchId: string,
  limit = 15,
): Promise<HerdActivityRow[]> {
  const rows = await db
    .select({
      id: animalEvents.id,
      animalId: animalEvents.animalId,
      animalTagId: animals.tagId,
      animalDisplayName: animals.displayName,
      eventType: animalEvents.eventType,
      occurredAt: animalEvents.occurredAt,
      summary: animalEvents.summary,
      eventData: animalEvents.eventData,
    })
    .from(animalEvents)
    .innerJoin(animals, eq(animalEvents.animalId, animals.id))
    .where(
      and(
        eq(animalEvents.ranchId, ranchId),
        inArray(animalEvents.eventType, ["vaccination", "treatment", "deworming", "note"]),
      ),
    )
    .orderBy(desc(animalEvents.occurredAt))
    .limit(limit * 3);

  const filtered = rows
    .filter((row) => {
      if (row.eventType !== "note") return true;
      const healthType = row.eventData?.healthRecordType;
      return typeof healthType === "string" && healthType.length > 0;
    })
    .slice(0, limit);

  return filtered.map((row) => ({
    id: row.id,
    animalId: row.animalId,
    animalTagId: row.animalTagId,
    animalDisplayName: row.animalDisplayName,
    eventType: row.eventType,
    occurredAt: row.occurredAt,
    summary: row.summary,
  }));
}
