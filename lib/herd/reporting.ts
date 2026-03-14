import { and, asc, eq, sql } from "drizzle-orm";
import { animals } from "@/lib/db/schema";
import { db } from "@/lib/db/client";
import type { AnimalSpecies } from "@/lib/db/schema";
import { compareAnimalSpecies, formatAnimalSpecies } from "@/lib/herd/constants";
import { getProtocolDueItemsForRanch } from "@/lib/herd/protocol-queries";

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

export interface HerdInventoryReportRow {
  species: AnimalSpecies;
  animalClass: string | null;
  status: string;
  count: number;
}

export async function getHerdInventoryReport(
  ranchId: string,
): Promise<HerdInventoryReportRow[]> {
  const rows = await db
    .select({
      species: animals.species,
      animalClass: animals.animalClass,
      status: animals.status,
      count: sql<number>`count(*)::int`,
    })
    .from(animals)
    .where(eq(animals.ranchId, ranchId))
    .groupBy(animals.species, animals.animalClass, animals.status)
    .orderBy(asc(animals.species), asc(animals.animalClass), asc(animals.status));

  return rows.sort((a, b) => {
    const speciesSort = compareAnimalSpecies(a.species, b.species);
    if (speciesSort !== 0) return speciesSort;
    if ((a.animalClass ?? "") !== (b.animalClass ?? "")) {
      return (a.animalClass ?? "").localeCompare(b.animalClass ?? "");
    }
    return a.status.localeCompare(b.status);
  });
}

export function buildHerdInventoryCsv(rows: HerdInventoryReportRow[]): string {
  return toCsv(
    ["Species", "Class", "Status", "Count"],
    rows.map((row) => [
      formatAnimalSpecies(row.species),
      row.animalClass,
      row.status,
      row.count,
    ]),
  );
}

export interface HerdDueReportRow {
  protocolName: string;
  protocolType: string;
  animalTagId: string;
  animalDisplayName: string | null;
  dueState: string;
  daysUntilDue: number;
  dueAt: Date;
  lastEventAt: Date | null;
}

export async function getHerdDueReport(ranchId: string): Promise<HerdDueReportRow[]> {
  const dueItems = await getProtocolDueItemsForRanch(ranchId, { limit: 5000 });
  return dueItems.map((item) => ({
    protocolName: item.protocolName,
    protocolType: item.protocolType,
    animalTagId: item.animalTagId,
    animalDisplayName: item.animalDisplayName,
    dueState: item.dueState,
    daysUntilDue: item.daysUntilDue,
    dueAt: item.dueAt,
    lastEventAt: item.lastEventAt,
  }));
}

export function buildHerdDueCsv(rows: HerdDueReportRow[]): string {
  return toCsv(
    [
      "Protocol",
      "Type",
      "Animal Tag",
      "Animal Name",
      "Due State",
      "Days Until Due",
      "Due Date",
      "Last Matching Event",
    ],
    rows.map((row) => [
      row.protocolName,
      row.protocolType,
      row.animalTagId,
      row.animalDisplayName,
      row.dueState,
      row.daysUntilDue,
      row.dueAt.toISOString().slice(0, 10),
      row.lastEventAt ? row.lastEventAt.toISOString() : "",
    ]),
  );
}

export async function getLifecycleSummaryLast30Days(ranchId: string) {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [births, losses, dispositions] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(animals)
      .where(
        and(
          eq(animals.ranchId, ranchId),
          eq(animals.status, "active"),
          sql`${animals.birthDate} >= ${since.toISOString().slice(0, 10)}`,
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(animals)
      .where(and(eq(animals.ranchId, ranchId), eq(animals.status, "deceased"))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(animals)
      .where(
        and(
          eq(animals.ranchId, ranchId),
          sql`${animals.status} in ('sold', 'culled', 'transferred')`,
        ),
      ),
  ]);

  return {
    births: births[0]?.count ?? 0,
    losses: losses[0]?.count ?? 0,
    dispositions: dispositions[0]?.count ?? 0,
  };
}
