import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  animalLocationAssignments,
  animals,
  landUnits,
  type AnimalSpecies,
} from "@/lib/db/schema";
import { getGrazingWorkspace } from "@/lib/grazing/queries";
import { formatAnimalSpecies } from "@/lib/herd/constants";

function escapeCsv(value: string | number | null | undefined): string {
  const stringValue = value == null ? "" : String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function toCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const headerRow = headers.map((value) => escapeCsv(value)).join(",");
  const body = rows.map((row) => row.map((value) => escapeCsv(value)).join(","));
  return [headerRow, ...body].join("\n");
}

export interface OccupancyReportRow {
  landUnitName: string;
  landUnitType: string;
  animalId: string;
  animalTagId: string;
  animalDisplayName: string | null;
  animalSpecies: AnimalSpecies;
  assignedAt: Date;
}

export async function getCurrentOccupancyReport(
  ranchId: string,
): Promise<OccupancyReportRow[]> {
  return db
    .select({
      landUnitName: landUnits.name,
      landUnitType: landUnits.unitType,
      animalId: animals.id,
      animalTagId: animals.tagId,
      animalDisplayName: animals.displayName,
      animalSpecies: animals.species,
      assignedAt: animalLocationAssignments.assignedAt,
    })
    .from(animalLocationAssignments)
    .innerJoin(landUnits, eq(animalLocationAssignments.landUnitId, landUnits.id))
    .innerJoin(animals, eq(animalLocationAssignments.animalId, animals.id))
    .where(
      and(
        eq(animalLocationAssignments.ranchId, ranchId),
        eq(animalLocationAssignments.isActive, true),
      ),
    )
    .orderBy(landUnits.name, animals.species, animals.displayName, animals.tagId);
}

export function buildOccupancyCsv(rows: OccupancyReportRow[]): string {
  return toCsv(
    [
      "Land Unit",
      "Unit Type",
      "Animal Tag",
      "Animal Name",
      "Species",
      "Assigned At",
    ],
    rows.map((row) => [
      row.landUnitName,
      row.landUnitType,
      row.animalTagId,
      row.animalDisplayName,
      formatAnimalSpecies(row.animalSpecies),
      row.assignedAt.toISOString(),
    ]),
  );
}

export interface MovementReportRow {
  landUnitName: string;
  animalTagId: string;
  animalDisplayName: string | null;
  species: AnimalSpecies;
  movementReason: string;
  assignedAt: Date;
  endedAt: Date | null;
}

export async function getRecentMovementReport(
  ranchId: string,
  days = 30,
): Promise<MovementReportRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  return db
    .select({
      landUnitName: landUnits.name,
      animalTagId: animals.tagId,
      animalDisplayName: animals.displayName,
      species: animals.species,
      movementReason: animalLocationAssignments.movementReason,
      assignedAt: animalLocationAssignments.assignedAt,
      endedAt: animalLocationAssignments.endedAt,
    })
    .from(animalLocationAssignments)
    .innerJoin(landUnits, eq(animalLocationAssignments.landUnitId, landUnits.id))
    .innerJoin(animals, eq(animalLocationAssignments.animalId, animals.id))
    .where(
      and(
        eq(animalLocationAssignments.ranchId, ranchId),
        gte(animalLocationAssignments.assignedAt, since),
      ),
    )
    .orderBy(desc(animalLocationAssignments.assignedAt))
    .limit(2000);
}

export function buildMovementCsv(rows: MovementReportRow[]): string {
  return toCsv(
    [
      "Land Unit",
      "Animal Tag",
      "Animal Name",
      "Species",
      "Movement Reason",
      "Moved In",
      "Moved Out",
    ],
    rows.map((row) => [
      row.landUnitName,
      row.animalTagId,
      row.animalDisplayName,
      formatAnimalSpecies(row.species),
      row.movementReason,
      row.assignedAt.toISOString(),
      row.endedAt ? row.endedAt.toISOString() : "",
    ]),
  );
}

export interface GrazingRestReportRow {
  landUnitName: string;
  unitType: string;
  state: string;
  daysResting: number | null;
  targetRestDays: number;
  restComplete: boolean | null;
}

export async function getGrazingRestReport(
  ranchId: string,
): Promise<GrazingRestReportRow[]> {
  const workspace = await getGrazingWorkspace(ranchId);
  return workspace.restRows.map((row) => ({
    landUnitName: row.landUnitName,
    unitType: row.unitType,
    state: row.state,
    daysResting: row.daysResting,
    targetRestDays: row.targetRestDays,
    restComplete: row.restComplete,
  }));
}

export function buildGrazingRestCsv(rows: GrazingRestReportRow[]): string {
  return toCsv(
    [
      "Land Unit",
      "Unit Type",
      "State",
      "Days Resting",
      "Target Rest Days",
      "Rest Complete",
    ],
    rows.map((row) => [
      row.landUnitName,
      row.unitType,
      row.state,
      row.daysResting,
      row.targetRestDays,
      row.restComplete == null ? "" : row.restComplete ? "yes" : "no",
    ]),
  );
}
