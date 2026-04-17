import {
  and,
  asc,
  desc,
  eq,
  ilike,
  isNotNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  animalEvents,
  animalLocationAssignments,
  animals,
  landUnits,
  ranchMemberships,
  users,
  type AnimalEventType,
  type AnimalSex,
  type AnimalSpecies,
  type AnimalStatus,
} from "@/lib/db/schema";
import {
  animalSexOptions,
  animalSpeciesOptions,
  animalStatusOptions,
  formatAnimalSpecies,
  formatAnimalStatus,
} from "./constants";

const speciesValues = new Set<AnimalSpecies>(animalSpeciesOptions.map((option) => option.value));
const sexValues = new Set<AnimalSex>(animalSexOptions.map((option) => option.value));
const statusValues = new Set<AnimalStatus>(animalStatusOptions.map((option) => option.value));

export interface AnimalRegistryFilters {
  search: string;
  species: AnimalSpecies | "all";
  status: AnimalStatus | "all";
  sex: AnimalSex | "all";
  animalClass: string;
}

export function resolveAnimalRegistryFilters(params: {
  q?: string;
  species?: string;
  status?: string;
  sex?: string;
  animalClass?: string;
}): AnimalRegistryFilters {
  const species = params.species && speciesValues.has(params.species as AnimalSpecies)
    ? (params.species as AnimalSpecies)
    : "all";
  const status = params.status && statusValues.has(params.status as AnimalStatus)
    ? (params.status as AnimalStatus)
    : "all";
  const sex = params.sex && sexValues.has(params.sex as AnimalSex)
    ? (params.sex as AnimalSex)
    : "all";

  return {
    search: params.q?.trim() ?? "",
    species,
    status,
    sex,
    animalClass: params.animalClass?.trim() ?? "",
  };
}

export interface AnimalRegistryRow {
  id: string;
  internalId: string;
  tagId: string;
  alternateId: string | null;
  displayName: string | null;
  species: AnimalSpecies;
  sex: AnimalSex;
  animalClass: string | null;
  breed: string | null;
  status: AnimalStatus;
  isArchived: boolean;
  currentLandUnitId: string | null;
  currentLandUnitName: string | null;
  updatedAt: Date;
}

export async function getAnimalRegistryRows(
  ranchId: string,
  filters: AnimalRegistryFilters,
): Promise<AnimalRegistryRow[]> {
  const conditions = [eq(animals.ranchId, ranchId)];

  if (filters.search) {
    const pattern = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(animals.tagId, pattern),
        ilike(animals.internalId, pattern),
        ilike(animals.displayName, pattern),
        ilike(animals.alternateId, pattern),
        ilike(animals.breed, pattern),
      )!,
    );
  }

  if (filters.species !== "all") {
    conditions.push(eq(animals.species, filters.species));
  }

  if (filters.status !== "all") {
    conditions.push(eq(animals.status, filters.status));
  }

  if (filters.sex !== "all") {
    conditions.push(eq(animals.sex, filters.sex));
  }

  if (filters.animalClass) {
    conditions.push(eq(animals.animalClass, filters.animalClass));
  }

  return db
    .select({
      id: animals.id,
      internalId: animals.internalId,
      tagId: animals.tagId,
      alternateId: animals.alternateId,
      displayName: animals.displayName,
      species: animals.species,
      sex: animals.sex,
      animalClass: animals.animalClass,
      breed: animals.breed,
      status: animals.status,
      isArchived: animals.isArchived,
      currentLandUnitId: landUnits.id,
      currentLandUnitName: landUnits.name,
      updatedAt: animals.updatedAt,
    })
    .from(animals)
    .leftJoin(
      animalLocationAssignments,
      and(
        eq(animalLocationAssignments.animalId, animals.id),
        eq(animalLocationAssignments.isActive, true),
      ),
    )
    .leftJoin(landUnits, eq(animalLocationAssignments.landUnitId, landUnits.id))
    .where(and(...conditions))
    .orderBy(asc(animals.tagId), asc(animals.internalId));
}

export async function getAnimalClassOptions(ranchId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({
      animalClass: animals.animalClass,
    })
    .from(animals)
    .where(and(eq(animals.ranchId, ranchId), isNotNull(animals.animalClass)))
    .orderBy(asc(animals.animalClass));

  return rows
    .map((row) => row.animalClass?.trim() ?? "")
    .filter((value) => value.length > 0);
}

export interface AnimalReferenceOption {
  id: string;
  label: string;
}

export async function getAnimalReferenceOptions(
  ranchId: string,
  options?: { excludeAnimalId?: string },
): Promise<AnimalReferenceOption[]> {
  const conditions = [eq(animals.ranchId, ranchId)];
  if (options?.excludeAnimalId) {
    conditions.push(ne(animals.id, options.excludeAnimalId));
  }

  const rows = await db
    .select({
      id: animals.id,
      tagId: animals.tagId,
      displayName: animals.displayName,
      species: animals.species,
      status: animals.status,
    })
    .from(animals)
    .where(and(...conditions))
    .orderBy(asc(animals.tagId), asc(animals.displayName));

  return rows.map((row) => ({
    id: row.id,
    label: `${row.tagId}${row.displayName ? ` Â· ${row.displayName}` : ""} (${formatAnimalSpecies(row.species)}, ${formatAnimalStatus(row.status)})`,
  }));
}

export interface AnimalEventTimelineRow {
  id: string;
  eventType: AnimalEventType;
  occurredAt: Date;
  summary: string;
  details: string | null;
  eventData: Record<string, unknown>;
  recordedByName: string | null;
  createdAt: Date;
}

export interface AnimalDetailRecord {
  id: string;
  ranchId: string;
  internalId: string;
  tagId: string;
  alternateId: string | null;
  displayName: string | null;
  species: AnimalSpecies;
  sex: AnimalSex;
  animalClass: string | null;
  breed: string | null;
  colorMarkings: string | null;
  newbornPairPhotoDataUrl: string | null;
  newbornPairPhotoCapturedAt: Date | null;
  status: AnimalStatus;
  birthDate: string | null;
  isBirthDateEstimated: boolean;
  sireAnimalId: string | null;
  damAnimalId: string | null;
  acquiredOn: string | null;
  acquisitionMethod: string | null;
  acquisitionSource: string | null;
  dispositionOn: string | null;
  dispositionReason: string | null;
  isArchived: boolean;
  archivedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  currentLandUnitId: string | null;
  currentLandUnitName: string | null;
  currentAssignedAt: Date | null;
}

export interface AnimalProfile {
  animal: AnimalDetailRecord;
  sire: AnimalReferenceOption | null;
  dam: AnimalReferenceOption | null;
  events: AnimalEventTimelineRow[];
}

export async function getAnimalProfile(
  ranchId: string,
  animalId: string,
): Promise<AnimalProfile | null> {
  const [animal] = await db
    .select({
      id: animals.id,
      ranchId: animals.ranchId,
      internalId: animals.internalId,
      tagId: animals.tagId,
      alternateId: animals.alternateId,
      displayName: animals.displayName,
      species: animals.species,
      sex: animals.sex,
      animalClass: animals.animalClass,
      breed: animals.breed,
      colorMarkings: animals.colorMarkings,
      newbornPairPhotoDataUrl: animals.newbornPairPhotoDataUrl,
      newbornPairPhotoCapturedAt: animals.newbornPairPhotoCapturedAt,
      status: animals.status,
      birthDate: animals.birthDate,
      isBirthDateEstimated: animals.isBirthDateEstimated,
      sireAnimalId: animals.sireAnimalId,
      damAnimalId: animals.damAnimalId,
      acquiredOn: animals.acquiredOn,
      acquisitionMethod: animals.acquisitionMethod,
      acquisitionSource: animals.acquisitionSource,
      dispositionOn: animals.dispositionOn,
      dispositionReason: animals.dispositionReason,
      isArchived: animals.isArchived,
      archivedAt: animals.archivedAt,
      notes: animals.notes,
      createdAt: animals.createdAt,
      updatedAt: animals.updatedAt,
      currentLandUnitId: landUnits.id,
      currentLandUnitName: landUnits.name,
      currentAssignedAt: animalLocationAssignments.assignedAt,
    })
    .from(animals)
    .leftJoin(
      animalLocationAssignments,
      and(
        eq(animalLocationAssignments.animalId, animals.id),
        eq(animalLocationAssignments.isActive, true),
      ),
    )
    .leftJoin(landUnits, eq(animalLocationAssignments.landUnitId, landUnits.id))
    .where(and(eq(animals.ranchId, ranchId), eq(animals.id, animalId)))
    .limit(1);

  if (!animal) {
    return null;
  }

  const [sireRow, damRow, eventRows] = await Promise.all([
    animal.sireAnimalId
      ? db
          .select({
            id: animals.id,
            tagId: animals.tagId,
            displayName: animals.displayName,
          })
          .from(animals)
          .where(and(eq(animals.ranchId, ranchId), eq(animals.id, animal.sireAnimalId)))
          .limit(1)
      : Promise.resolve([]),
    animal.damAnimalId
      ? db
          .select({
            id: animals.id,
            tagId: animals.tagId,
            displayName: animals.displayName,
          })
          .from(animals)
          .where(and(eq(animals.ranchId, ranchId), eq(animals.id, animal.damAnimalId)))
          .limit(1)
      : Promise.resolve([]),
    db
      .select({
        id: animalEvents.id,
        eventType: animalEvents.eventType,
        occurredAt: animalEvents.occurredAt,
        summary: animalEvents.summary,
        details: animalEvents.details,
        eventData: animalEvents.eventData,
        recordedByName: users.fullName,
        createdAt: animalEvents.createdAt,
      })
      .from(animalEvents)
      .leftJoin(
        ranchMemberships,
        eq(animalEvents.recordedByMembershipId, ranchMemberships.id),
      )
      .leftJoin(users, eq(ranchMemberships.userId, users.id))
      .where(and(eq(animalEvents.ranchId, ranchId), eq(animalEvents.animalId, animalId)))
      .orderBy(desc(animalEvents.occurredAt), desc(animalEvents.createdAt)),
  ]);

  return {
    animal,
    sire: sireRow[0]
      ? {
          id: sireRow[0].id,
          label: `${sireRow[0].tagId}${sireRow[0].displayName ? ` Â· ${sireRow[0].displayName}` : ""}`,
        }
      : null,
    dam: damRow[0]
      ? {
          id: damRow[0].id,
          label: `${damRow[0].tagId}${damRow[0].displayName ? ` Â· ${damRow[0].displayName}` : ""}`,
        }
      : null,
    events: eventRows,
  };
}

export interface HerdRegistrySummary {
  totalAnimals: number;
  activeAnimals: number;
  soldAnimals: number;
  deceasedAnimals: number;
  archivedAnimals: number;
}

export async function getHerdRegistrySummary(ranchId: string): Promise<HerdRegistrySummary> {
  const [totalAnimals, activeAnimals, soldAnimals, deceasedAnimals, archivedAnimals] =
    await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(animals)
        .where(eq(animals.ranchId, ranchId)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(animals)
        .where(and(eq(animals.ranchId, ranchId), eq(animals.status, "active"))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(animals)
        .where(and(eq(animals.ranchId, ranchId), eq(animals.status, "sold"))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(animals)
        .where(and(eq(animals.ranchId, ranchId), eq(animals.status, "deceased"))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(animals)
        .where(and(eq(animals.ranchId, ranchId), eq(animals.status, "archived"))),
    ]);

  return {
    totalAnimals: totalAnimals[0]?.count ?? 0,
    activeAnimals: activeAnimals[0]?.count ?? 0,
    soldAnimals: soldAnimals[0]?.count ?? 0,
    deceasedAnimals: deceasedAnimals[0]?.count ?? 0,
    archivedAnimals: archivedAnimals[0]?.count ?? 0,
  };
}


