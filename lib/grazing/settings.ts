import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { herdLandSettings } from "@/lib/db/schema";

export interface GrazingAssumptions {
  planningDemandBasis: string;
  demandLbsPerAnimalUnitDay: number;
  defaultUtilizationPercent: number;
  defaultRestDays: number;
  speciesMultipliers: {
    cattle: number;
    horse: number;
    other: number;
  };
  classMultipliers: Record<string, number>;
}

export const defaultGrazingAssumptions: GrazingAssumptions = {
  planningDemandBasis: "animal_unit_day",
  demandLbsPerAnimalUnitDay: 26,
  defaultUtilizationPercent: 45,
  defaultRestDays: 30,
  speciesMultipliers: {
    cattle: 1,
    horse: 1.2,
    other: 1,
  },
  classMultipliers: {},
};

export async function getOrCreateHerdLandSettings(ranchId: string) {
  const [existing] = await db
    .select({
      ranchId: herdLandSettings.ranchId,
      speciesDefaults: herdLandSettings.speciesDefaults,
      reproductiveDefaults: herdLandSettings.reproductiveDefaults,
      grazingDefaults: herdLandSettings.grazingDefaults,
      calculationDefaults: herdLandSettings.calculationDefaults,
      updatedAt: herdLandSettings.updatedAt,
    })
    .from(herdLandSettings)
    .where(eq(herdLandSettings.ranchId, ranchId))
    .limit(1);

  if (existing) return existing;

  await db.insert(herdLandSettings).values({
    ranchId,
    speciesDefaults: {},
    reproductiveDefaults: {},
    grazingDefaults: defaultGrazingAssumptions as unknown as Record<string, unknown>,
    calculationDefaults: {},
  });

  const [created] = await db
    .select({
      ranchId: herdLandSettings.ranchId,
      speciesDefaults: herdLandSettings.speciesDefaults,
      reproductiveDefaults: herdLandSettings.reproductiveDefaults,
      grazingDefaults: herdLandSettings.grazingDefaults,
      calculationDefaults: herdLandSettings.calculationDefaults,
      updatedAt: herdLandSettings.updatedAt,
    })
    .from(herdLandSettings)
    .where(eq(herdLandSettings.ranchId, ranchId))
    .limit(1);

  if (!created) {
    throw new Error("Unable to create herd/land settings row.");
  }

  return created;
}

export function resolveGrazingAssumptions(raw: unknown): GrazingAssumptions {
  const defaults = defaultGrazingAssumptions;
  if (!raw || typeof raw !== "object") {
    return defaults;
  }

  const source = raw as Record<string, unknown>;
  const speciesRaw =
    source.speciesMultipliers && typeof source.speciesMultipliers === "object"
      ? (source.speciesMultipliers as Record<string, unknown>)
      : {};
  const classRaw =
    source.classMultipliers && typeof source.classMultipliers === "object"
      ? (source.classMultipliers as Record<string, unknown>)
      : {};

  const classMultipliers: Record<string, number> = {};
  for (const [key, value] of Object.entries(classRaw)) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      classMultipliers[key.trim().toLowerCase()] = value;
    }
  }

  return {
    planningDemandBasis:
      typeof source.planningDemandBasis === "string" && source.planningDemandBasis.trim().length
        ? source.planningDemandBasis
        : defaults.planningDemandBasis,
    demandLbsPerAnimalUnitDay:
      typeof source.demandLbsPerAnimalUnitDay === "number" &&
      Number.isFinite(source.demandLbsPerAnimalUnitDay) &&
      source.demandLbsPerAnimalUnitDay > 0
        ? source.demandLbsPerAnimalUnitDay
        : defaults.demandLbsPerAnimalUnitDay,
    defaultUtilizationPercent:
      typeof source.defaultUtilizationPercent === "number" &&
      Number.isFinite(source.defaultUtilizationPercent) &&
      source.defaultUtilizationPercent > 0 &&
      source.defaultUtilizationPercent <= 100
        ? source.defaultUtilizationPercent
        : defaults.defaultUtilizationPercent,
    defaultRestDays:
      typeof source.defaultRestDays === "number" &&
      Number.isFinite(source.defaultRestDays) &&
      source.defaultRestDays >= 0
        ? source.defaultRestDays
        : defaults.defaultRestDays,
    speciesMultipliers: {
      cattle:
        typeof speciesRaw.cattle === "number" &&
        Number.isFinite(speciesRaw.cattle) &&
        speciesRaw.cattle > 0
          ? speciesRaw.cattle
          : defaults.speciesMultipliers.cattle,
      horse:
        typeof speciesRaw.horse === "number" &&
        Number.isFinite(speciesRaw.horse) &&
        speciesRaw.horse > 0
          ? speciesRaw.horse
          : defaults.speciesMultipliers.horse,
      other:
        typeof speciesRaw.other === "number" &&
        Number.isFinite(speciesRaw.other) &&
        speciesRaw.other > 0
          ? speciesRaw.other
          : defaults.speciesMultipliers.other,
    },
    classMultipliers,
  };
}
