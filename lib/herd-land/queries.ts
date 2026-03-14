import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  animalEvents,
  animalGroups,
  animalLocationAssignments,
  animals,
  landUnits,
} from "@/lib/db/schema";

async function countByQuery<T>(query: Promise<T[]>): Promise<number> {
  const rows = await query;
  const first = rows[0] as { count?: number } | undefined;
  return first?.count ?? 0;
}

export interface HerdFoundationSummary {
  totalAnimals: number;
  activeAnimals: number;
  horseCount: number;
  activeGroups: number;
  totalEvents: number;
  activeAssignments: number;
}

export async function getHerdFoundationSummary(
  ranchId: string,
): Promise<HerdFoundationSummary> {
  const [
    totalAnimals,
    activeAnimals,
    horseCount,
    activeGroups,
    totalEvents,
    activeAssignments,
  ] = await Promise.all([
    countByQuery(
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(animals)
        .where(eq(animals.ranchId, ranchId)),
    ),
    countByQuery(
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(animals)
        .where(
          and(
            eq(animals.ranchId, ranchId),
            eq(animals.status, "active"),
            eq(animals.isArchived, false),
          ),
        ),
    ),
    countByQuery(
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(animals)
        .where(and(eq(animals.ranchId, ranchId), eq(animals.species, "horse"))),
    ),
    countByQuery(
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(animalGroups)
        .where(and(eq(animalGroups.ranchId, ranchId), eq(animalGroups.isActive, true))),
    ),
    countByQuery(
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(animalEvents)
        .where(eq(animalEvents.ranchId, ranchId)),
    ),
    countByQuery(
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(animalLocationAssignments)
        .where(
          and(
            eq(animalLocationAssignments.ranchId, ranchId),
            eq(animalLocationAssignments.isActive, true),
          ),
        ),
    ),
  ]);

  return {
    totalAnimals,
    activeAnimals,
    horseCount,
    activeGroups,
    totalEvents,
    activeAssignments,
  };
}

export interface LandFoundationSummary {
  totalUnits: number;
  activeUnits: number;
  grazingScaleUnits: number;
  handlingUnits: number;
  activeOccupancyAssignments: number;
}

export async function getLandFoundationSummary(
  ranchId: string,
): Promise<LandFoundationSummary> {
  const [totalUnits, activeUnits, grazingScaleUnits, handlingUnits, activeOccupancyAssignments] =
    await Promise.all([
      countByQuery(
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(landUnits)
          .where(eq(landUnits.ranchId, ranchId)),
      ),
      countByQuery(
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(landUnits)
          .where(and(eq(landUnits.ranchId, ranchId), eq(landUnits.isActive, true))),
      ),
      countByQuery(
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(landUnits)
          .where(
            and(
              eq(landUnits.ranchId, ranchId),
              inArray(landUnits.unitType, ["pasture", "field", "trap", "lot"]),
            ),
          ),
      ),
      countByQuery(
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(landUnits)
          .where(
            and(
              eq(landUnits.ranchId, ranchId),
              inArray(landUnits.unitType, [
                "corral",
                "pen",
                "stall",
                "barn_area",
                "holding_area",
              ]),
            ),
          ),
      ),
      countByQuery(
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(animalLocationAssignments)
          .where(
            and(
              eq(animalLocationAssignments.ranchId, ranchId),
              eq(animalLocationAssignments.isActive, true),
            ),
          ),
      ),
    ]);

  return {
    totalUnits,
    activeUnits,
    grazingScaleUnits,
    handlingUnits,
    activeOccupancyAssignments,
  };
}
