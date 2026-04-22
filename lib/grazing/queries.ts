import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  animalGroups,
  animalGroupMemberships,
  animalLocationAssignments,
  animals,
  grazingPeriodAnimals,
  grazingPeriods,
  landUnits,
  type AnimalSpecies,
  type GrazingPeriodStatus,
  type LandUnitType,
} from "@/lib/db/schema";
import {
  getOrCreateHerdLandSettings,
  resolveGrazingAssumptions,
  type GrazingAssumptions,
} from "./settings";
import { compareAnimalSpecies } from "@/lib/herd/constants";

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export interface GrazingEstimateResult {
  canEstimate: boolean;
  missingInputs: string[];
  availableForageLbs: number | null;
  demandPerDayLbs: number | null;
  estimatedGrazingDays: number | null;
  projectedMoveDate: Date | null;
  assumptionsUsed: {
    utilizationPercent: number;
    demandLbsPerAnimalUnitDay: number;
    speciesMultipliers: {
      cattle: number;
      horse: number;
      other: number;
    };
  };
}

interface EstimateAnimalInput {
  species: AnimalSpecies;
  animalClass: string | null;
}

function toNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveClassMultiplier(
  className: string | null,
  assumptions: GrazingAssumptions,
): number {
  if (!className) return 1;
  const key = className.trim().toLowerCase();
  return assumptions.classMultipliers[key] ?? 1;
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * MS_PER_DAY);
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function parseDateKey(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

function toValidDate(value: Date | string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const candidate = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(candidate.getTime())) {
    return null;
  }

  return candidate;
}

function resolveSpeciesDemandMultiplier(
  species: AnimalSpecies,
  assumptions: GrazingAssumptions,
): number {
  if (species === "horse") return assumptions.speciesMultipliers.horse;
  if (species === "cattle") return assumptions.speciesMultipliers.cattle;
  return assumptions.speciesMultipliers.other;
}

export function computeGrazingEstimate(params: {
  startedOn: string;
  startedAt?: Date;
  grazeableAcreage: string | null;
  estimatedForageLbsPerAcre: string | null;
  unitUtilizationPercent: number | null;
  participantAnimals: EstimateAnimalInput[];
  assumptions: GrazingAssumptions;
}): GrazingEstimateResult {
  const missingInputs: string[] = [];

  const grazeableAcreage = toNumber(params.grazeableAcreage);
  const forageLbsPerAcre = toNumber(params.estimatedForageLbsPerAcre);
  const utilizationPercent =
    params.unitUtilizationPercent ?? params.assumptions.defaultUtilizationPercent;
  const demandPerAnimalUnitDay = params.assumptions.demandLbsPerAnimalUnitDay;

  if (!grazeableAcreage || grazeableAcreage <= 0) {
    missingInputs.push("grazeable acreage");
  }
  if (!forageLbsPerAcre || forageLbsPerAcre <= 0) {
    missingInputs.push("estimated forage lbs/acre");
  }
  if (!params.participantAnimals.length) {
    missingInputs.push("animals linked to this grazing period or active occupancy");
  }

  const speciesMultipliers = params.assumptions.speciesMultipliers;
  const demandAnimalUnits = params.participantAnimals.reduce((total, animal) => {
    const speciesMultiplier = resolveSpeciesDemandMultiplier(animal.species, params.assumptions);
    return total + speciesMultiplier * resolveClassMultiplier(animal.animalClass, params.assumptions);
  }, 0);

  const demandPerDayLbs = demandAnimalUnits * demandPerAnimalUnitDay;
  if (!(demandPerDayLbs > 0)) {
    missingInputs.push("positive herd demand basis");
  }

  if (missingInputs.length) {
    return {
      canEstimate: false,
      missingInputs,
      availableForageLbs: null,
      demandPerDayLbs: null,
      estimatedGrazingDays: null,
      projectedMoveDate: null,
      assumptionsUsed: {
        utilizationPercent,
        demandLbsPerAnimalUnitDay: demandPerAnimalUnitDay,
        speciesMultipliers,
      },
    };
  }

  const availableForageLbs =
    grazeableAcreage! * forageLbsPerAcre! * (utilizationPercent / 100);
  const estimatedGrazingDays = availableForageLbs / demandPerDayLbs;
  const estimateStartAt = params.startedAt ?? parseDateKey(params.startedOn);
  const projectedMoveDate = addDays(
    estimateStartAt,
    Math.max(1, Math.ceil(estimatedGrazingDays)),
  );

  return {
    canEstimate: true,
    missingInputs: [],
    availableForageLbs,
    demandPerDayLbs,
    estimatedGrazingDays,
    projectedMoveDate,
    assumptionsUsed: {
      utilizationPercent,
      demandLbsPerAnimalUnitDay: demandPerAnimalUnitDay,
      speciesMultipliers,
    },
  };
}

export function computeGrazingEstimateFromSpeciesCounts(params: {
  startedOn: string;
  grazeableAcreage: string | null;
  estimatedForageLbsPerAcre: string | null;
  unitUtilizationPercent: number | null;
  speciesCounts: Partial<Record<AnimalSpecies, number>>;
  assumptions: GrazingAssumptions;
}): GrazingEstimateResult {
  const missingInputs: string[] = [];

  const grazeableAcreage = toNumber(params.grazeableAcreage);
  const forageLbsPerAcre = toNumber(params.estimatedForageLbsPerAcre);
  const utilizationPercent =
    params.unitUtilizationPercent ?? params.assumptions.defaultUtilizationPercent;
  const demandPerAnimalUnitDay = params.assumptions.demandLbsPerAnimalUnitDay;

  if (!grazeableAcreage || grazeableAcreage <= 0) {
    missingInputs.push("grazeable acreage");
  }
  if (!forageLbsPerAcre || forageLbsPerAcre <= 0) {
    missingInputs.push("estimated forage lbs/acre");
  }

  const speciesEntries = Object.entries(params.speciesCounts) as Array<[AnimalSpecies, number]>;
  const normalizedEntries = speciesEntries
    .map(([species, count]) => ({
      species,
      count: Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0,
    }))
    .filter((entry) => entry.count > 0);

  if (!normalizedEntries.length) {
    missingInputs.push("headcount by species");
  }

  const demandAnimalUnits = normalizedEntries.reduce((total, entry) => {
    const speciesMultiplier = resolveSpeciesDemandMultiplier(entry.species, params.assumptions);
    return total + speciesMultiplier * entry.count;
  }, 0);

  const demandPerDayLbs = demandAnimalUnits * demandPerAnimalUnitDay;
  if (!(demandPerDayLbs > 0)) {
    missingInputs.push("positive herd demand basis");
  }

  if (missingInputs.length) {
    return {
      canEstimate: false,
      missingInputs,
      availableForageLbs: null,
      demandPerDayLbs: null,
      estimatedGrazingDays: null,
      projectedMoveDate: null,
      assumptionsUsed: {
        utilizationPercent,
        demandLbsPerAnimalUnitDay: demandPerAnimalUnitDay,
        speciesMultipliers: params.assumptions.speciesMultipliers,
      },
    };
  }

  const availableForageLbs =
    grazeableAcreage! * forageLbsPerAcre! * (utilizationPercent / 100);
  const estimatedGrazingDays = availableForageLbs / demandPerDayLbs;
  const projectedMoveDate = addDays(
    parseDateKey(params.startedOn),
    Math.max(1, Math.ceil(estimatedGrazingDays)),
  );

  return {
    canEstimate: true,
    missingInputs: [],
    availableForageLbs,
    demandPerDayLbs,
    estimatedGrazingDays,
    projectedMoveDate,
    assumptionsUsed: {
      utilizationPercent,
      demandLbsPerAnimalUnitDay: demandPerAnimalUnitDay,
      speciesMultipliers: params.assumptions.speciesMultipliers,
    },
  };
}

export interface GrazingPeriodWorkspaceRow {
  periodId: string;
  source: "recorded_period" | "occupancy_estimate";
  landUnitId: string;
  landUnitName: string;
  unitType: LandUnitType;
  status: GrazingPeriodStatus;
  startedOn: string;
  startedAt: Date | null;
  endedOn: string | null;
  plannedMoveOn: string | null;
  notes: string | null;
  participantCount: number;
  participantLabels: string[];
  participantSpeciesMix: Array<{ species: AnimalSpecies; count: number }>;
  estimate: GrazingEstimateResult;
}

export interface GrazingRestRow {
  landUnitId: string;
  landUnitName: string;
  unitType: LandUnitType;
  state: "in_use" | "resting" | "no_history";
  daysResting: number | null;
  restStartedAt: Date | null;
  readyAt: Date | null;
  hoursUntilReady: number | null;
  targetRestDays: number;
  restComplete: boolean | null;
}

export interface GrazingWorkspace {
  assumptions: GrazingAssumptions;
  activePeriods: GrazingPeriodWorkspaceRow[];
  recentPeriods: GrazingPeriodWorkspaceRow[];
  rotationSoon: GrazingPeriodWorkspaceRow[];
  restRows: GrazingRestRow[];
  formOptions: {
    landUnits: Array<{
      id: string;
      name: string;
      unitType: LandUnitType;
      grazeableAcreage: string | null;
      estimatedForageLbsPerAcre: string | null;
      targetUtilizationPercent: number | null;
    }>;
    animalGroups: Array<{ id: string; name: string; memberCount: number }>;
    animals: Array<{ id: string; label: string }>;
    occupancyAssignments: Array<{
      landUnitId: string;
      animalId: string;
      label: string;
    }>;
  };
}

export interface GrazingMoveAlertRow {
  periodId: string;
  source: "recorded_period" | "occupancy_estimate";
  landUnitId: string;
  landUnitName: string;
  moveBy: Date;
  hoursUntilMove: number;
}

export interface GrazingMoveAlertSummary {
  dueNowCount: number;
  overdueCount: number;
  dueSoonCount: number;
  rows: GrazingMoveAlertRow[];
}

export async function getGrazingWorkspace(ranchId: string): Promise<GrazingWorkspace> {
  const settingsRow = await getOrCreateHerdLandSettings(ranchId);
  const assumptions = resolveGrazingAssumptions(settingsRow.grazingDefaults);

  const [
    unitRows,
    periodRows,
    periodAnimalRows,
    occupancyRows,
    latestMoveOutRows,
    groupRows,
    animalRows,
  ] =
    await Promise.all([
      db
        .select({
          id: landUnits.id,
          name: landUnits.name,
          unitType: landUnits.unitType,
          grazeableAcreage: landUnits.grazeableAcreage,
          estimatedForageLbsPerAcre: landUnits.estimatedForageLbsPerAcre,
          targetUtilizationPercent: landUnits.targetUtilizationPercent,
          targetRestDays: landUnits.targetRestDays,
          isActive: landUnits.isActive,
        })
        .from(landUnits)
        .where(eq(landUnits.ranchId, ranchId))
        .orderBy(asc(landUnits.sortOrder), asc(landUnits.name)),
      db
        .select({
          periodId: grazingPeriods.id,
          landUnitId: grazingPeriods.landUnitId,
          status: grazingPeriods.status,
          startedOn: grazingPeriods.startedOn,
          endedOn: grazingPeriods.endedOn,
          plannedMoveOn: grazingPeriods.plannedMoveOn,
          notes: grazingPeriods.notes,
          updatedAt: grazingPeriods.updatedAt,
        })
        .from(grazingPeriods)
        .where(eq(grazingPeriods.ranchId, ranchId))
        .orderBy(desc(grazingPeriods.startedOn), desc(grazingPeriods.createdAt)),
      db
        .select({
          periodId: grazingPeriodAnimals.grazingPeriodId,
          animalId: animals.id,
          tagId: animals.tagId,
          displayName: animals.displayName,
          species: animals.species,
          animalClass: animals.animalClass,
        })
        .from(grazingPeriodAnimals)
        .innerJoin(animals, eq(grazingPeriodAnimals.animalId, animals.id))
        .where(eq(grazingPeriodAnimals.ranchId, ranchId)),
      db
        .select({
          landUnitId: animalLocationAssignments.landUnitId,
          animalId: animals.id,
          tagId: animals.tagId,
          displayName: animals.displayName,
          species: animals.species,
          animalClass: animals.animalClass,
          assignedAt: animalLocationAssignments.assignedAt,
        })
        .from(animalLocationAssignments)
        .innerJoin(animals, eq(animalLocationAssignments.animalId, animals.id))
        .where(
          and(
            eq(animalLocationAssignments.ranchId, ranchId),
            eq(animalLocationAssignments.isActive, true),
          ),
        ),
      db
        .select({
          landUnitId: animalLocationAssignments.landUnitId,
          lastEndedAt: sql<Date>`max(${animalLocationAssignments.endedAt})`,
        })
        .from(animalLocationAssignments)
        .where(
          and(
            eq(animalLocationAssignments.ranchId, ranchId),
            sql`${animalLocationAssignments.endedAt} is not null`,
          ),
        )
        .groupBy(animalLocationAssignments.landUnitId),
      db
        .select({
          id: animalGroups.id,
          name: animalGroups.name,
          memberCount: sql<number>`count(${animals.id})::int`,
        })
        .from(animalGroups)
        .leftJoin(
          animalGroupMemberships,
          and(
            eq(animalGroupMemberships.animalGroupId, animalGroups.id),
            eq(animalGroupMemberships.ranchId, ranchId),
            eq(animalGroupMemberships.isActive, true),
          ),
        )
        .leftJoin(
          animals,
          and(
            eq(animalGroupMemberships.animalId, animals.id),
            eq(animals.status, "active"),
            eq(animals.isArchived, false),
          ),
        )
        .where(and(eq(animalGroups.ranchId, ranchId), eq(animalGroups.isActive, true)))
        .groupBy(animalGroups.id, animalGroups.name)
        .orderBy(asc(animalGroups.name)),
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

  const unitById = new Map(unitRows.map((unit) => [unit.id, unit] as const));

  const participantsByPeriod = new Map<string, typeof periodAnimalRows>();
  for (const row of periodAnimalRows) {
    const current = participantsByPeriod.get(row.periodId) ?? [];
    current.push(row);
    participantsByPeriod.set(row.periodId, current);
  }

  const occupancyByUnit = new Map<string, typeof occupancyRows>();
  for (const row of occupancyRows) {
    const current = occupancyByUnit.get(row.landUnitId) ?? [];
    current.push(row);
    occupancyByUnit.set(row.landUnitId, current);
  }

  const workspaceRows: GrazingPeriodWorkspaceRow[] = [];
  for (const period of periodRows) {
    const unit = unitById.get(period.landUnitId);
    if (!unit) continue;

    const linkedAnimals = participantsByPeriod.get(period.periodId) ?? [];
    const fallbackAnimals = occupancyByUnit.get(period.landUnitId) ?? [];
    const estimateAnimals = linkedAnimals.length ? linkedAnimals : fallbackAnimals;
    const estimate = computeGrazingEstimate({
      startedOn: period.startedOn,
      grazeableAcreage: unit.grazeableAcreage,
      estimatedForageLbsPerAcre: unit.estimatedForageLbsPerAcre,
      unitUtilizationPercent: unit.targetUtilizationPercent,
      participantAnimals: estimateAnimals.map((animal) => ({
        species: animal.species,
        animalClass: animal.animalClass,
      })),
      assumptions,
    });
    const speciesMixMap = new Map<AnimalSpecies, number>();
    for (const animal of estimateAnimals) {
      speciesMixMap.set(animal.species, (speciesMixMap.get(animal.species) ?? 0) + 1);
    }
    const participantSpeciesMix = [...speciesMixMap.entries()]
      .map(([species, count]) => ({ species, count }))
      .sort((a, b) => compareAnimalSpecies(a.species, b.species));

    workspaceRows.push({
      periodId: period.periodId,
      source: "recorded_period",
      landUnitId: unit.id,
      landUnitName: unit.name,
      unitType: unit.unitType,
      status: period.status,
      startedOn: period.startedOn,
      startedAt: parseDateKey(period.startedOn),
      endedOn: period.endedOn,
      plannedMoveOn: period.plannedMoveOn,
      notes: period.notes,
      participantCount: estimateAnimals.length,
      participantLabels: estimateAnimals
        .slice(0, 4)
        .map((animal) =>
          animal.displayName ? `${animal.displayName} (${animal.tagId})` : animal.tagId,
        ),
      participantSpeciesMix,
      estimate,
    });
  }

  const unitsWithActiveOrPlannedPeriod = new Set(
    workspaceRows
      .filter((row) => row.status === "active" || row.status === "planned")
      .map((row) => row.landUnitId),
  );

  for (const unit of unitRows) {
    if (unitsWithActiveOrPlannedPeriod.has(unit.id)) continue;
    const participants = occupancyByUnit.get(unit.id) ?? [];
    if (!participants.length) continue;

    const startedAt = participants.reduce(
      (earliest, row) => (row.assignedAt < earliest ? row.assignedAt : earliest),
      participants[0]!.assignedAt,
    );
    const startedOn = startedAt.toISOString().slice(0, 10);
    const estimate = computeGrazingEstimate({
      startedOn,
      startedAt,
      grazeableAcreage: unit.grazeableAcreage,
      estimatedForageLbsPerAcre: unit.estimatedForageLbsPerAcre,
      unitUtilizationPercent: unit.targetUtilizationPercent,
      participantAnimals: participants.map((animal) => ({
        species: animal.species,
        animalClass: animal.animalClass,
      })),
      assumptions,
    });

    const speciesMixMap = new Map<AnimalSpecies, number>();
    for (const animal of participants) {
      speciesMixMap.set(animal.species, (speciesMixMap.get(animal.species) ?? 0) + 1);
    }
    const participantSpeciesMix = [...speciesMixMap.entries()]
      .map(([species, count]) => ({ species, count }))
      .sort((a, b) => compareAnimalSpecies(a.species, b.species));

    workspaceRows.push({
      periodId: `occupancy-${unit.id}`,
      source: "occupancy_estimate",
      landUnitId: unit.id,
      landUnitName: unit.name,
      unitType: unit.unitType,
      status: "active",
      startedOn,
      startedAt,
      endedOn: null,
      plannedMoveOn: null,
      notes: "Derived from active occupancy movements.",
      participantCount: participants.length,
      participantLabels: participants
        .slice(0, 4)
        .map((animal) =>
          animal.displayName ? `${animal.displayName} (${animal.tagId})` : animal.tagId,
        ),
      participantSpeciesMix,
      estimate,
    });
  }

  const activePeriods = workspaceRows
    .filter((row) => row.status === "active" || row.status === "planned")
    .sort((a, b) => {
      const aMove = a.plannedMoveOn ? parseDateKey(a.plannedMoveOn) : a.estimate.projectedMoveDate;
      const bMove = b.plannedMoveOn ? parseDateKey(b.plannedMoveOn) : b.estimate.projectedMoveDate;
      if (aMove && bMove) return aMove.getTime() - bMove.getTime();
      if (aMove) return -1;
      if (bMove) return 1;
      return a.landUnitName.localeCompare(b.landUnitName);
    });
  const recentPeriods = workspaceRows
    .filter((row) => row.source === "recorded_period")
    .slice(0, 15);

  const today = startOfToday();
  const soonThreshold = addDays(today, 3);
  const rotationSoon = activePeriods.filter((period) => {
    const moveDate = period.plannedMoveOn
      ? parseDateKey(period.plannedMoveOn)
      : period.estimate.projectedMoveDate;
    if (!moveDate) return false;
    return moveDate <= soonThreshold;
  });

  const latestCompletedByUnit = new Map<string, { endedOn: string; updatedAt: Date }>();
  for (const row of periodRows) {
    if (row.status !== "completed" || !row.endedOn) continue;
    const existing = latestCompletedByUnit.get(row.landUnitId);
    if (
      !existing ||
      row.endedOn > existing.endedOn ||
      (row.endedOn === existing.endedOn && row.updatedAt > existing.updatedAt)
    ) {
      latestCompletedByUnit.set(row.landUnitId, {
        endedOn: row.endedOn,
        updatedAt: row.updatedAt,
      });
    }
  }

  const latestMoveOutByUnit = new Map<string, Date>(
    latestMoveOutRows
      .map((row) => ({
        landUnitId: row.landUnitId,
        lastEndedAt: toValidDate(row.lastEndedAt),
      }))
      .filter((row): row is { landUnitId: string; lastEndedAt: Date } =>
        Boolean(row.lastEndedAt),
      )
      .map((row) => [row.landUnitId, row.lastEndedAt] as const),
  );

  const activeUnitIds = new Set(
    workspaceRows.filter((period) => period.status === "active").map((period) => period.landUnitId),
  );
  const occupiedUnitIds = new Set(occupancyRows.map((row) => row.landUnitId));
  const inUseUnitIds = new Set([...activeUnitIds, ...occupiedUnitIds]);
  const now = new Date();

  const restRows: GrazingRestRow[] = unitRows.map((unit) => {
    const targetRestDays = unit.targetRestDays ?? assumptions.defaultRestDays;
    if (inUseUnitIds.has(unit.id)) {
      return {
        landUnitId: unit.id,
        landUnitName: unit.name,
        unitType: unit.unitType,
        state: "in_use",
        daysResting: null,
        restStartedAt: null,
        readyAt: null,
        hoursUntilReady: null,
        targetRestDays,
        restComplete: null,
      };
    }

    const latestMoveOutAt = latestMoveOutByUnit.get(unit.id) ?? null;
    const latestCompleted = latestCompletedByUnit.get(unit.id);
    const restStartedAt =
      latestMoveOutAt ??
      (latestCompleted?.endedOn ? parseDateKey(latestCompleted.endedOn) : null);

    if (!restStartedAt) {
      return {
        landUnitId: unit.id,
        landUnitName: unit.name,
        unitType: unit.unitType,
        state: "no_history",
        daysResting: null,
        restStartedAt: null,
        readyAt: null,
        hoursUntilReady: null,
        targetRestDays,
        restComplete: null,
      };
    }

    const restingMs = Math.max(0, now.getTime() - restStartedAt.getTime());
    const daysResting = restingMs / MS_PER_DAY;
    const readyAt = addDays(restStartedAt, targetRestDays);
    const restComplete = now.getTime() >= readyAt.getTime();
    const hoursUntilReady = restComplete
      ? 0
      : Math.max(1, Math.ceil((readyAt.getTime() - now.getTime()) / MS_PER_HOUR));

    return {
      landUnitId: unit.id,
      landUnitName: unit.name,
      unitType: unit.unitType,
      state: "resting",
      daysResting,
      restStartedAt,
      readyAt,
      hoursUntilReady,
      targetRestDays,
      restComplete,
    };
  });

  const activeUnitById = new Map(
    unitRows
      .filter((unit) => unit.isActive)
      .map((unit) => [unit.id, unit] as const),
  );
  const occupancyAssignments = occupancyRows
    .filter((row) => activeUnitById.has(row.landUnitId))
    .map((row) => {
      const unit = activeUnitById.get(row.landUnitId)!;
      const animalLabel = row.displayName ? `${row.displayName} (${row.tagId})` : row.tagId;
      return {
        landUnitId: row.landUnitId,
        animalId: row.animalId,
        label: `${unit.name}: ${animalLabel}`,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    assumptions,
    activePeriods,
    recentPeriods,
    rotationSoon,
    restRows,
    formOptions: {
      landUnits: unitRows
        .filter((unit) => unit.isActive)
        .map((unit) => ({
          id: unit.id,
          name: unit.name,
          unitType: unit.unitType,
          grazeableAcreage: unit.grazeableAcreage,
          estimatedForageLbsPerAcre: unit.estimatedForageLbsPerAcre,
          targetUtilizationPercent: unit.targetUtilizationPercent,
        })),
      animalGroups: groupRows,
      animals: animalRows.map((animal) => ({
        id: animal.id,
        label: animal.displayName
          ? `${animal.displayName} (${animal.tagId})`
          : animal.tagId,
      })),
      occupancyAssignments,
    },
  };
}

function projectedMoveForPeriod(period: Pick<GrazingPeriodWorkspaceRow, "plannedMoveOn" | "estimate">): Date | null {
  return period.plannedMoveOn ? parseDateKey(period.plannedMoveOn) : period.estimate.projectedMoveDate;
}

export async function getGrazingMoveAlertSummary(
  ranchId: string,
  options?: { soonHours?: number; limit?: number },
): Promise<GrazingMoveAlertSummary> {
  const soonHours = options?.soonHours ?? 72;
  const limit = options?.limit ?? 12;
  const now = new Date();
  const workspace = await getGrazingWorkspace(ranchId);

  const allAlerts = workspace.activePeriods
    .map((period) => {
      const moveBy = projectedMoveForPeriod(period);
      if (!moveBy) return null;
      const hoursUntilMove = Math.ceil((moveBy.getTime() - now.getTime()) / MS_PER_HOUR);
      return {
        periodId: period.periodId,
        source: period.source,
        landUnitId: period.landUnitId,
        landUnitName: period.landUnitName,
        moveBy,
        hoursUntilMove,
      } satisfies GrazingMoveAlertRow;
    })
    .filter((row): row is GrazingMoveAlertRow => Boolean(row));

  const dueNowCount = allAlerts.filter((row) => row.hoursUntilMove <= 0).length;
  const overdueCount = allAlerts.filter((row) => row.hoursUntilMove < 0).length;
  const dueSoonCount = allAlerts.filter(
    (row) => row.hoursUntilMove > 0 && row.hoursUntilMove <= soonHours,
  ).length;

  const rows = allAlerts
    .filter((row) => row.hoursUntilMove <= 0 || row.hoursUntilMove <= soonHours)
    .sort((a, b) => a.hoursUntilMove - b.hoursUntilMove)
    .slice(0, limit);

  return {
    dueNowCount,
    overdueCount,
    dueSoonCount,
    rows,
  };
}

export interface LandUnitGrazingHistoryRow {
  periodId: string;
  status: GrazingPeriodStatus;
  startedOn: string;
  endedOn: string | null;
  plannedMoveOn: string | null;
  notes: string | null;
  animalGroupId: string | null;
  animalGroupName: string | null;
  linkedAnimalCount: number;
}

export async function getLandUnitGrazingHistory(
  ranchId: string,
  landUnitId: string,
): Promise<LandUnitGrazingHistoryRow[]> {
  const periodRows = await db
    .select({
      periodId: grazingPeriods.id,
      status: grazingPeriods.status,
      startedOn: grazingPeriods.startedOn,
      endedOn: grazingPeriods.endedOn,
      plannedMoveOn: grazingPeriods.plannedMoveOn,
      notes: grazingPeriods.notes,
      animalGroupId: grazingPeriods.animalGroupId,
      animalGroupName: animalGroups.name,
    })
    .from(grazingPeriods)
    .leftJoin(animalGroups, eq(grazingPeriods.animalGroupId, animalGroups.id))
    .where(
      and(
        eq(grazingPeriods.ranchId, ranchId),
        eq(grazingPeriods.landUnitId, landUnitId),
      ),
    )
    .orderBy(desc(grazingPeriods.startedOn), desc(grazingPeriods.createdAt));

  if (!periodRows.length) return [];

  const linkedAnimalRows = await db
    .select({
      periodId: grazingPeriodAnimals.grazingPeriodId,
      animalId: grazingPeriodAnimals.animalId,
    })
    .from(grazingPeriodAnimals)
    .where(
      and(
        eq(grazingPeriodAnimals.ranchId, ranchId),
        inArray(
          grazingPeriodAnimals.grazingPeriodId,
          periodRows.map((row) => row.periodId),
        ),
      ),
    );

  const countByPeriod = new Map<string, number>();
  for (const row of linkedAnimalRows) {
    countByPeriod.set(row.periodId, (countByPeriod.get(row.periodId) ?? 0) + 1);
  }

  return periodRows.map((row) => ({
    ...row,
    linkedAnimalCount: countByPeriod.get(row.periodId) ?? 0,
  }));
}
