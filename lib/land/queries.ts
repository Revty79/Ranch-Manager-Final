import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  animalLocationAssignments,
  animals,
  landUnits,
  ranchMemberships,
  users,
  type AnimalSex,
  type AnimalSpecies,
  type AnimalStatus,
  type LandUnitType,
  type MovementReason,
} from "@/lib/db/schema";
import { compareAnimalSpecies } from "@/lib/herd/constants";
import { handlingUnitTypes, landUnitTypeOptions } from "./constants";

const landUnitTypeSet = new Set<LandUnitType>(landUnitTypeOptions.map((option) => option.value));

export interface LandUnitFilters {
  search: string;
  unitType: LandUnitType | "all";
  activity: "all" | "active" | "inactive";
}

export function resolveLandUnitFilters(params: {
  q?: string;
  unitType?: string;
  activity?: string;
}): LandUnitFilters {
  const unitType =
    params.unitType && landUnitTypeSet.has(params.unitType as LandUnitType)
      ? (params.unitType as LandUnitType)
      : "all";

  const activity =
    params.activity === "active" || params.activity === "inactive"
      ? params.activity
      : "all";

  return {
    search: params.q?.trim() ?? "",
    unitType,
    activity,
  };
}

export interface LandUnitListRow {
  id: string;
  name: string;
  code: string | null;
  unitType: LandUnitType;
  isActive: boolean;
  acreage: string | null;
  grazeableAcreage: string | null;
  estimatedForageLbsPerAcre: string | null;
  targetUtilizationPercent: number | null;
  targetRestDays: number | null;
  waterSummary: string | null;
  fencingSummary: string | null;
  seasonalNotes: string | null;
  notes: string | null;
  sortOrder: number;
  occupancyCount: number;
  horseOccupancyCount: number;
  updatedAt: Date;
}

export async function getLandUnitsForRanch(
  ranchId: string,
  filters: LandUnitFilters,
): Promise<LandUnitListRow[]> {
  const conditions = [eq(landUnits.ranchId, ranchId)];

  if (filters.search) {
    const pattern = `%${filters.search}%`;
    conditions.push(or(ilike(landUnits.name, pattern), ilike(landUnits.code, pattern))!);
  }

  if (filters.unitType !== "all") {
    conditions.push(eq(landUnits.unitType, filters.unitType));
  }

  if (filters.activity !== "all") {
    conditions.push(eq(landUnits.isActive, filters.activity === "active"));
  }

  return db
    .select({
      id: landUnits.id,
      name: landUnits.name,
      code: landUnits.code,
      unitType: landUnits.unitType,
      isActive: landUnits.isActive,
      acreage: landUnits.acreage,
      grazeableAcreage: landUnits.grazeableAcreage,
      estimatedForageLbsPerAcre: landUnits.estimatedForageLbsPerAcre,
      targetUtilizationPercent: landUnits.targetUtilizationPercent,
      targetRestDays: landUnits.targetRestDays,
      waterSummary: landUnits.waterSummary,
      fencingSummary: landUnits.fencingSummary,
      seasonalNotes: landUnits.seasonalNotes,
      notes: landUnits.notes,
      sortOrder: landUnits.sortOrder,
      occupancyCount: sql<number>`count(${animalLocationAssignments.id})::int`,
      horseOccupancyCount: sql<number>`count(case when ${animals.species} = 'horse' then 1 end)::int`,
      updatedAt: landUnits.updatedAt,
    })
    .from(landUnits)
    .leftJoin(
      animalLocationAssignments,
      and(
        eq(animalLocationAssignments.landUnitId, landUnits.id),
        eq(animalLocationAssignments.isActive, true),
      ),
    )
    .leftJoin(animals, eq(animalLocationAssignments.animalId, animals.id))
    .where(and(...conditions))
    .groupBy(
      landUnits.id,
      landUnits.name,
      landUnits.code,
      landUnits.unitType,
      landUnits.isActive,
      landUnits.acreage,
      landUnits.grazeableAcreage,
      landUnits.estimatedForageLbsPerAcre,
      landUnits.targetUtilizationPercent,
      landUnits.targetRestDays,
      landUnits.waterSummary,
      landUnits.fencingSummary,
      landUnits.seasonalNotes,
      landUnits.notes,
      landUnits.sortOrder,
      landUnits.updatedAt,
    )
    .orderBy(asc(landUnits.sortOrder), asc(landUnits.name));
}

export interface LandUnitSummary {
  totalUnits: number;
  activeUnits: number;
  handlingUnits: number;
  occupiedUnits: number;
}

export async function getLandUnitSummary(ranchId: string): Promise<LandUnitSummary> {
  const [totalRows, activeRows, handlingRows, occupiedRows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(landUnits)
      .where(eq(landUnits.ranchId, ranchId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(landUnits)
      .where(and(eq(landUnits.ranchId, ranchId), eq(landUnits.isActive, true))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(landUnits)
      .where(
        and(
          eq(landUnits.ranchId, ranchId),
          inArray(landUnits.unitType, handlingUnitTypes),
        ),
      ),
    db
      .select({
        count: sql<number>`count(distinct ${animalLocationAssignments.landUnitId})::int`,
      })
      .from(animalLocationAssignments)
      .where(
        and(
          eq(animalLocationAssignments.ranchId, ranchId),
          eq(animalLocationAssignments.isActive, true),
        ),
      ),
  ]);

  return {
    totalUnits: totalRows[0]?.count ?? 0,
    activeUnits: activeRows[0]?.count ?? 0,
    handlingUnits: handlingRows[0]?.count ?? 0,
    occupiedUnits: occupiedRows[0]?.count ?? 0,
  };
}

export interface LandUnitCurrentOccupant {
  animalId: string;
  tagId: string;
  displayName: string | null;
  species: AnimalSpecies;
  sex: AnimalSex;
  animalClass: string | null;
  status: AnimalStatus;
  assignedAt: Date;
  movementReason: MovementReason;
  notes: string | null;
}

export interface LandMovementHistoryRow {
  assignmentId: string;
  animalId: string;
  tagId: string;
  displayName: string | null;
  species: AnimalSpecies;
  assignedAt: Date;
  endedAt: Date | null;
  movementReason: MovementReason;
  notes: string | null;
  assignedByName: string | null;
}

export interface LandMovementAnimalOption {
  animalId: string;
  label: string;
  currentLandUnitId: string | null;
  currentLandUnitName: string | null;
}

export interface LandUnitProfile {
  landUnit: Omit<LandUnitListRow, "updatedAt"> & {
    createdAt: Date;
    currentUse: string | null;
    currentStatus: string | null;
    updatedAt: Date;
  };
  currentOccupants: LandUnitCurrentOccupant[];
  occupancyBySpecies: Array<{ species: AnimalSpecies; count: number }>;
  sourceAnimalClassOptions: string[];
  movementHistory: LandMovementHistoryRow[];
  movementAnimalOptions: LandMovementAnimalOption[];
  destinationUnitOptions: Array<{ id: string; name: string; unitType: LandUnitType }>;
}

export async function getLandUnitProfile(
  ranchId: string,
  landUnitId: string,
): Promise<LandUnitProfile | null> {
  const [landUnit] = await db
    .select({
      id: landUnits.id,
      name: landUnits.name,
      code: landUnits.code,
      unitType: landUnits.unitType,
      isActive: landUnits.isActive,
      acreage: landUnits.acreage,
      grazeableAcreage: landUnits.grazeableAcreage,
      estimatedForageLbsPerAcre: landUnits.estimatedForageLbsPerAcre,
      targetUtilizationPercent: landUnits.targetUtilizationPercent,
      targetRestDays: landUnits.targetRestDays,
      waterSummary: landUnits.waterSummary,
      fencingSummary: landUnits.fencingSummary,
      seasonalNotes: landUnits.seasonalNotes,
      notes: landUnits.notes,
      sortOrder: landUnits.sortOrder,
      occupancyCount: sql<number>`count(${animalLocationAssignments.id})::int`,
      horseOccupancyCount: sql<number>`count(case when ${animals.species} = 'horse' then 1 end)::int`,
      currentUse: landUnits.currentUse,
      currentStatus: landUnits.currentStatus,
      createdAt: landUnits.createdAt,
      updatedAt: landUnits.updatedAt,
    })
    .from(landUnits)
    .leftJoin(
      animalLocationAssignments,
      and(
        eq(animalLocationAssignments.landUnitId, landUnits.id),
        eq(animalLocationAssignments.isActive, true),
      ),
    )
    .leftJoin(animals, eq(animalLocationAssignments.animalId, animals.id))
    .where(and(eq(landUnits.ranchId, ranchId), eq(landUnits.id, landUnitId)))
    .groupBy(
      landUnits.id,
      landUnits.name,
      landUnits.code,
      landUnits.unitType,
      landUnits.isActive,
      landUnits.acreage,
      landUnits.grazeableAcreage,
      landUnits.estimatedForageLbsPerAcre,
      landUnits.targetUtilizationPercent,
      landUnits.targetRestDays,
      landUnits.waterSummary,
      landUnits.fencingSummary,
      landUnits.seasonalNotes,
      landUnits.notes,
      landUnits.sortOrder,
      landUnits.currentUse,
      landUnits.currentStatus,
      landUnits.createdAt,
      landUnits.updatedAt,
    )
    .limit(1);

  if (!landUnit) {
    return null;
  }

  const [currentOccupants, movementHistory, movementAnimalRows, destinationUnitOptions] =
    await Promise.all([
    db
      .select({
        animalId: animals.id,
        tagId: animals.tagId,
        displayName: animals.displayName,
        species: animals.species,
        sex: animals.sex,
        animalClass: animals.animalClass,
        status: animals.status,
        assignedAt: animalLocationAssignments.assignedAt,
        movementReason: animalLocationAssignments.movementReason,
        notes: animalLocationAssignments.notes,
      })
      .from(animalLocationAssignments)
      .innerJoin(animals, eq(animalLocationAssignments.animalId, animals.id))
      .where(
        and(
          eq(animalLocationAssignments.ranchId, ranchId),
          eq(animalLocationAssignments.landUnitId, landUnitId),
          eq(animalLocationAssignments.isActive, true),
        ),
      )
      .orderBy(
        asc(sql`case when ${animals.species} = 'horse' then 0 else 1 end`),
        asc(animals.displayName),
        asc(animals.tagId),
      ),
    db
      .select({
        assignmentId: animalLocationAssignments.id,
        animalId: animals.id,
        tagId: animals.tagId,
        displayName: animals.displayName,
        species: animals.species,
        assignedAt: animalLocationAssignments.assignedAt,
        endedAt: animalLocationAssignments.endedAt,
        movementReason: animalLocationAssignments.movementReason,
        notes: animalLocationAssignments.notes,
        assignedByName: users.fullName,
      })
      .from(animalLocationAssignments)
      .innerJoin(animals, eq(animalLocationAssignments.animalId, animals.id))
      .leftJoin(
        ranchMemberships,
        eq(animalLocationAssignments.assignedByMembershipId, ranchMemberships.id),
      )
      .leftJoin(users, eq(ranchMemberships.userId, users.id))
      .where(
        and(
          eq(animalLocationAssignments.ranchId, ranchId),
          eq(animalLocationAssignments.landUnitId, landUnitId),
        ),
      )
      .orderBy(desc(animalLocationAssignments.assignedAt))
      .limit(200),
    db
      .select({
        animalId: animals.id,
        tagId: animals.tagId,
        displayName: animals.displayName,
        species: animals.species,
      })
      .from(animals)
      .where(
        and(
          eq(animals.ranchId, ranchId),
          eq(animals.status, "active"),
          eq(animals.isArchived, false),
        ),
      )
      .orderBy(
        asc(sql`case when ${animals.species} = 'horse' then 0 else 1 end`),
        asc(animals.displayName),
        asc(animals.tagId),
      ),
    db
      .select({
        id: landUnits.id,
        name: landUnits.name,
        unitType: landUnits.unitType,
      })
      .from(landUnits)
      .where(
        and(
          eq(landUnits.ranchId, ranchId),
          eq(landUnits.isActive, true),
          ne(landUnits.id, landUnitId),
        ),
      )
      .orderBy(asc(landUnits.sortOrder), asc(landUnits.name)),
    ]);

  const activeLocationRows = movementAnimalRows.length
    ? await db
        .select({
          animalId: animalLocationAssignments.animalId,
          currentLandUnitId: animalLocationAssignments.landUnitId,
          currentLandUnitName: landUnits.name,
        })
        .from(animalLocationAssignments)
        .innerJoin(landUnits, eq(animalLocationAssignments.landUnitId, landUnits.id))
        .where(
          and(
            eq(animalLocationAssignments.ranchId, ranchId),
            eq(animalLocationAssignments.isActive, true),
            inArray(
              animalLocationAssignments.animalId,
              movementAnimalRows.map((row) => row.animalId),
            ),
          ),
        )
    : [];

  const activeLocationByAnimal = new Map(
    activeLocationRows.map((row) => [row.animalId, row] as const),
  );

  const movementAnimalOptions: LandMovementAnimalOption[] = movementAnimalRows.map((row) => {
    const activeLocation = activeLocationByAnimal.get(row.animalId);
    const preferredLabel =
      row.species === "horse" && row.displayName
        ? `${row.displayName} (${row.tagId})`
        : `${row.tagId}${row.displayName ? ` · ${row.displayName}` : ""}`;
    const locationLabel = activeLocation?.currentLandUnitName
      ? ` · currently in ${activeLocation.currentLandUnitName}`
      : "";
    return {
      animalId: row.animalId,
      label: `${preferredLabel}${locationLabel}`,
      currentLandUnitId: activeLocation?.currentLandUnitId ?? null,
      currentLandUnitName: activeLocation?.currentLandUnitName ?? null,
    };
  });

  const speciesCountMap = new Map<AnimalSpecies, number>();
  for (const occupant of currentOccupants) {
    speciesCountMap.set(
      occupant.species,
      (speciesCountMap.get(occupant.species) ?? 0) + 1,
    );
  }
  const occupancyBySpecies = [...speciesCountMap.entries()]
    .map(([species, count]) => ({ species, count }))
    .sort((a, b) => compareAnimalSpecies(a.species, b.species));

  const sourceAnimalClassOptions = [...new Set(
    currentOccupants
      .map((occupant) => occupant.animalClass?.trim() ?? "")
      .filter((value) => value.length > 0),
  )].sort((a, b) => a.localeCompare(b));

  return {
    landUnit,
    currentOccupants,
    occupancyBySpecies,
    sourceAnimalClassOptions,
    movementHistory,
    movementAnimalOptions,
    destinationUnitOptions,
  };
}
