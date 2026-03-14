import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db } from "../lib/db/client";
import { hashPassword } from "../lib/auth/password";
import {
  animalEvents,
  animalLocationAssignments,
  animals,
  type AnimalSpecies,
  type AnimalEventType,
  grazingPeriodAnimals,
  grazingPeriods,
  herdLandSettings,
  herdProtocolTemplates,
  landUnits,
  ranchMemberships,
  ranches,
  shifts,
  users,
  workOrderAssignments,
  workOrders,
  workTimeEntries,
} from "../lib/db/schema";

function assertSafeToSeed() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run demo seed in production.");
  }

  if (process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Set ALLOW_DEMO_SEED=true to run this script.");
  }
}

async function ensureUser({
  email,
  fullName,
  password,
}: {
  email: string;
  fullName: string;
  password: string;
}) {
  const normalizedEmail = email.toLowerCase();
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existing) {
    return existing.id;
  }

  const passwordHash = await hashPassword(password);
  const [created] = await db
    .insert(users)
    .values({
      email: normalizedEmail,
      fullName,
      passwordHash,
      onboardingState: "complete",
    })
    .returning({ id: users.id });

  return created.id;
}

async function ensureRanch() {
  const [existing] = await db
    .select({ id: ranches.id })
    .from(ranches)
    .where(eq(ranches.slug, "demo-ranch"))
    .limit(1);

  if (existing) {
    await db
      .update(ranches)
      .set({
        name: "Demo Ranch",
        onboardingCompleted: true,
        betaLifetimeAccess: true,
        subscriptionStatus: "inactive",
        subscriptionUpdatedAt: new Date(),
      })
      .where(eq(ranches.id, existing.id));
    return existing.id;
  }

  const [created] = await db
    .insert(ranches)
    .values({
      name: "Demo Ranch",
      slug: "demo-ranch",
      onboardingCompleted: true,
      betaLifetimeAccess: true,
      subscriptionStatus: "inactive",
      subscriptionUpdatedAt: new Date(),
    })
    .returning({ id: ranches.id });

  return created.id;
}

async function ensureMembership({
  ranchId,
  userId,
  role,
  payType,
  payRateCents,
}: {
  ranchId: string;
  userId: string;
  role: "owner" | "manager" | "worker";
  payType: "hourly" | "salary";
  payRateCents: number;
}) {
  const [existing] = await db
    .select({ id: ranchMemberships.id })
    .from(ranchMemberships)
    .where(
      and(eq(ranchMemberships.ranchId, ranchId), eq(ranchMemberships.userId, userId)),
    )
    .limit(1);

  if (existing) {
    await db
      .update(ranchMemberships)
      .set({
        role,
        payType,
        payRateCents,
        isActive: true,
        deactivatedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(ranchMemberships.id, existing.id));
    return existing.id;
  }

  const [created] = await db
    .insert(ranchMemberships)
    .values({
      ranchId,
      userId,
      role,
      payType,
      payRateCents,
      isActive: true,
    })
    .returning({ id: ranchMemberships.id });

  return created.id;
}

async function ensureWorkOrder({
  ranchId,
  title,
  description,
  status,
  priority,
  createdByMembershipId,
}: {
  ranchId: string;
  title: string;
  description: string;
  status: "open" | "in_progress";
  priority: "normal" | "high";
  createdByMembershipId: string;
}) {
  const [existing] = await db
    .select({ id: workOrders.id })
    .from(workOrders)
    .where(and(eq(workOrders.ranchId, ranchId), eq(workOrders.title, title)))
    .limit(1);

  if (existing) {
    await db
      .update(workOrders)
      .set({
        description,
        status,
        priority,
        createdByMembershipId,
        updatedAt: new Date(),
      })
      .where(eq(workOrders.id, existing.id));
    return existing.id;
  }

  const [created] = await db
    .insert(workOrders)
    .values({
      ranchId,
      title,
      description,
      status,
      priority,
      createdByMembershipId,
      dueAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    })
    .returning({ id: workOrders.id });

  return created.id;
}

async function ensureAssignment(workOrderId: string, membershipId: string) {
  const [existing] = await db
    .select({ id: workOrderAssignments.id })
    .from(workOrderAssignments)
    .where(
      and(
        eq(workOrderAssignments.workOrderId, workOrderId),
        eq(workOrderAssignments.membershipId, membershipId),
      ),
    )
    .limit(1);

  if (!existing) {
    await db.insert(workOrderAssignments).values({
      workOrderId,
      membershipId,
    });
  }
}

async function ensureLandUnit({
  ranchId,
  name,
  code,
  unitType,
  acreage,
  grazeableAcreage,
  estimatedForageLbsPerAcre,
  targetUtilizationPercent,
  targetRestDays,
}: {
  ranchId: string;
  name: string;
  code: string;
  unitType: "pasture" | "corral" | "stall";
  acreage: string;
  grazeableAcreage: string;
  estimatedForageLbsPerAcre: string;
  targetUtilizationPercent: number;
  targetRestDays: number;
}) {
  const [existing] = await db
    .select({ id: landUnits.id })
    .from(landUnits)
    .where(and(eq(landUnits.ranchId, ranchId), eq(landUnits.name, name)))
    .limit(1);

  if (existing) {
    await db
      .update(landUnits)
      .set({
        code,
        unitType,
        isActive: true,
        acreage,
        grazeableAcreage,
        estimatedForageLbsPerAcre,
        targetUtilizationPercent,
        targetRestDays,
        updatedAt: new Date(),
      })
      .where(eq(landUnits.id, existing.id));
    return existing.id;
  }

  const [created] = await db
    .insert(landUnits)
    .values({
      ranchId,
      name,
      code,
      unitType,
      isActive: true,
      acreage,
      grazeableAcreage,
      estimatedForageLbsPerAcre,
      targetUtilizationPercent,
      targetRestDays,
    })
    .returning({ id: landUnits.id });

  return created.id;
}

async function ensureAnimal({
  ranchId,
  internalId,
  tagId,
  displayName,
  species,
  sex,
  animalClass,
  breed,
}: {
  ranchId: string;
  internalId: string;
  tagId: string;
  displayName: string | null;
  species: AnimalSpecies;
  sex: "female" | "male";
  animalClass: string;
  breed: string;
}) {
  const [existing] = await db
    .select({ id: animals.id })
    .from(animals)
    .where(and(eq(animals.ranchId, ranchId), eq(animals.tagId, tagId)))
    .limit(1);

  if (existing) {
    await db
      .update(animals)
      .set({
        internalId,
        displayName,
        species,
        sex,
        animalClass,
        breed,
        status: "active",
        isArchived: false,
        updatedAt: new Date(),
      })
      .where(eq(animals.id, existing.id));
    return existing.id;
  }

  const [created] = await db
    .insert(animals)
    .values({
      ranchId,
      internalId,
      tagId,
      displayName,
      species,
      sex,
      animalClass,
      breed,
      status: "active",
      isArchived: false,
    })
    .returning({ id: animals.id });

  return created.id;
}

async function ensureAnimalAssignment({
  ranchId,
  animalId,
  landUnitId,
  assignedByMembershipId,
}: {
  ranchId: string;
  animalId: string;
  landUnitId: string;
  assignedByMembershipId: string;
}) {
  const [activeAssignment] = await db
    .select({
      id: animalLocationAssignments.id,
      landUnitId: animalLocationAssignments.landUnitId,
    })
    .from(animalLocationAssignments)
    .where(
      and(
        eq(animalLocationAssignments.ranchId, ranchId),
        eq(animalLocationAssignments.animalId, animalId),
        eq(animalLocationAssignments.isActive, true),
      ),
    )
    .limit(1);

  if (activeAssignment?.landUnitId === landUnitId) {
    return;
  }

  await db
    .update(animalLocationAssignments)
    .set({
      isActive: false,
      endedAt: new Date(),
    })
    .where(
      and(
        eq(animalLocationAssignments.ranchId, ranchId),
        eq(animalLocationAssignments.animalId, animalId),
        eq(animalLocationAssignments.isActive, true),
      ),
    );

  await db.insert(animalLocationAssignments).values({
    ranchId,
    animalId,
    landUnitId,
    movementReason: "grazing_rotation",
    assignedByMembershipId,
    isActive: true,
  });
}

async function ensureAnimalEvent({
  ranchId,
  animalId,
  eventType,
  summary,
  daysAgo,
  eventData,
}: {
  ranchId: string;
  animalId: string;
  eventType: AnimalEventType;
  summary: string;
  daysAgo: number;
  eventData?: Record<string, unknown>;
}) {
  const occurredAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

  const [existing] = await db
    .select({ id: animalEvents.id })
    .from(animalEvents)
    .where(
      and(
        eq(animalEvents.ranchId, ranchId),
        eq(animalEvents.animalId, animalId),
        eq(animalEvents.eventType, eventType),
        eq(animalEvents.summary, summary),
      ),
    )
    .limit(1);

  if (existing) {
    return;
  }

  await db.insert(animalEvents).values({
    ranchId,
    animalId,
    eventType,
    summary,
    occurredAt,
    eventData: eventData ?? {},
  });
}

async function ensureProtocolTemplate({
  ranchId,
  name,
  protocolType,
  intervalDays,
  dueSoonDays,
}: {
  ranchId: string;
  name: string;
  protocolType:
    | "vaccination"
    | "deworming"
    | "pregnancy_check"
    | "pre_breeding"
    | "pre_birth_planning";
  intervalDays: number;
  dueSoonDays: number;
}) {
  const [existing] = await db
    .select({ id: herdProtocolTemplates.id })
    .from(herdProtocolTemplates)
    .where(
      and(
        eq(herdProtocolTemplates.ranchId, ranchId),
        eq(herdProtocolTemplates.name, name),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(herdProtocolTemplates)
      .set({
        protocolType,
        intervalDays,
        dueSoonDays,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(herdProtocolTemplates.id, existing.id));
    return existing.id;
  }

  const [created] = await db
    .insert(herdProtocolTemplates)
    .values({
      ranchId,
      name,
      protocolType,
      intervalDays,
      dueSoonDays,
      isActive: true,
    })
    .returning({ id: herdProtocolTemplates.id });

  return created.id;
}

async function ensureGrazingDefaults(ranchId: string) {
  const [existing] = await db
    .select({ ranchId: herdLandSettings.ranchId })
    .from(herdLandSettings)
    .where(eq(herdLandSettings.ranchId, ranchId))
    .limit(1);

  const defaults = {
    planningDemandBasis: "animal_unit_day",
    demandLbsPerAnimalUnitDay: 26,
    defaultUtilizationPercent: 45,
    defaultRestDays: 30,
    speciesMultipliers: { cattle: 1, horse: 1.2, other: 1 },
    classMultipliers: { calf: 0.6 },
  };

  if (!existing) {
    await db.insert(herdLandSettings).values({
      ranchId,
      grazingDefaults: defaults,
      speciesDefaults: {},
      reproductiveDefaults: {},
      calculationDefaults: {},
    });
    return;
  }

  await db
    .update(herdLandSettings)
    .set({
      grazingDefaults: defaults,
      updatedAt: new Date(),
    })
    .where(eq(herdLandSettings.ranchId, ranchId));
}

async function ensureGrazingPeriod({
  ranchId,
  landUnitId,
  createdByMembershipId,
  animalIds,
}: {
  ranchId: string;
  landUnitId: string;
  createdByMembershipId: string;
  animalIds: string[];
}) {
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - 2);
  const startedOn = periodStart.toISOString().slice(0, 10);

  const [existing] = await db
    .select({ id: grazingPeriods.id })
    .from(grazingPeriods)
    .where(
      and(
        eq(grazingPeriods.ranchId, ranchId),
        eq(grazingPeriods.landUnitId, landUnitId),
        eq(grazingPeriods.startedOn, startedOn),
      ),
    )
    .limit(1);

  const periodId =
    existing?.id ??
    (
      await db
        .insert(grazingPeriods)
        .values({
          ranchId,
          landUnitId,
          status: "active",
          startedOn,
          notes: "Demo grazing period",
          plannedMoveOn: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10),
          createdByMembershipId,
        })
        .returning({ id: grazingPeriods.id })
    )[0].id;

  for (const animalId of animalIds) {
    const [link] = await db
      .select({ id: grazingPeriodAnimals.id })
      .from(grazingPeriodAnimals)
      .where(
        and(
          eq(grazingPeriodAnimals.ranchId, ranchId),
          eq(grazingPeriodAnimals.grazingPeriodId, periodId),
          eq(grazingPeriodAnimals.animalId, animalId),
        ),
      )
      .limit(1);
    if (!link) {
      await db.insert(grazingPeriodAnimals).values({
        ranchId,
        grazingPeriodId: periodId,
        animalId,
      });
    }
  }
}

async function seedShiftAndWorkHistory({
  ranchId,
  membershipId,
  workOrderId,
}: {
  ranchId: string;
  membershipId: string;
  workOrderId: string;
}) {
  const [existing] = await db
    .select({ id: shifts.id })
    .from(shifts)
    .where(and(eq(shifts.ranchId, ranchId), eq(shifts.membershipId, membershipId)))
    .limit(1);

  if (existing) {
    return;
  }

  for (let dayOffset = 3; dayOffset >= 1; dayOffset -= 1) {
    const shiftStart = new Date();
    shiftStart.setHours(7, 0, 0, 0);
    shiftStart.setDate(shiftStart.getDate() - dayOffset);

    const shiftEnd = new Date(shiftStart);
    shiftEnd.setHours(15, 0, 0, 0);

    const [createdShift] = await db
      .insert(shifts)
      .values({
        ranchId,
        membershipId,
        startedAt: shiftStart,
        endedAt: shiftEnd,
      })
      .returning({ id: shifts.id });

    if (!createdShift) continue;

    const taskStart = new Date(shiftStart);
    taskStart.setHours(8, 0, 0, 0);
    const taskEnd = new Date(shiftStart);
    taskEnd.setHours(12, 0, 0, 0);

    await db.insert(workTimeEntries).values({
      ranchId,
      membershipId,
      workOrderId,
      startedAt: taskStart,
      endedAt: taskEnd,
    });
  }
}

async function main() {
  assertSafeToSeed();

  const demoPassword = process.env.DEMO_SEED_PASSWORD ?? "DemoRanch123!";
  const ownerUserId = await ensureUser({
    email: "owner@demoranch.local",
    fullName: "Demo Owner",
    password: demoPassword,
  });
  const managerUserId = await ensureUser({
    email: "manager@demoranch.local",
    fullName: "Demo Manager",
    password: demoPassword,
  });
  const workerUserId = await ensureUser({
    email: "worker@demoranch.local",
    fullName: "Demo Worker",
    password: demoPassword,
  });

  const ranchId = await ensureRanch();
  const ownerMembershipId = await ensureMembership({
    ranchId,
    userId: ownerUserId,
    role: "owner",
    payType: "salary",
    payRateCents: 250000,
  });
  await db
    .update(users)
    .set({
      onboardingState: "complete",
      lastActiveRanchId: ranchId,
      updatedAt: new Date(),
    })
    .where(eq(users.id, ownerUserId));

  const managerMembershipId = await ensureMembership({
    ranchId,
    userId: managerUserId,
    role: "manager",
    payType: "hourly",
    payRateCents: 3200,
  });
  const workerMembershipId = await ensureMembership({
    ranchId,
    userId: workerUserId,
    role: "worker",
    payType: "hourly",
    payRateCents: 2200,
  });

  const workOrderA = await ensureWorkOrder({
    ranchId,
    title: "North Fence Repair",
    description: "Replace two damaged panels and inspect line posts.",
    status: "open",
    priority: "high",
    createdByMembershipId: ownerMembershipId,
  });
  const workOrderB = await ensureWorkOrder({
    ranchId,
    title: "Water Line Inspection",
    description: "Inspect and test pressure for the east pipeline segment.",
    status: "in_progress",
    priority: "normal",
    createdByMembershipId: managerMembershipId,
  });

  await ensureAssignment(workOrderA, workerMembershipId);
  await ensureAssignment(workOrderB, workerMembershipId);
  await ensureAssignment(workOrderB, managerMembershipId);

  await seedShiftAndWorkHistory({
    ranchId,
    membershipId: workerMembershipId,
    workOrderId: workOrderB,
  });

  await ensureGrazingDefaults(ranchId);

  const northPastureId = await ensureLandUnit({
    ranchId,
    name: "North Pasture",
    code: "NP-1",
    unitType: "pasture",
    acreage: "140.00",
    grazeableAcreage: "128.00",
    estimatedForageLbsPerAcre: "900.00",
    targetUtilizationPercent: 45,
    targetRestDays: 32,
  });
  const mainCorralId = await ensureLandUnit({
    ranchId,
    name: "Main Corral",
    code: "COR-1",
    unitType: "corral",
    acreage: "2.50",
    grazeableAcreage: "2.00",
    estimatedForageLbsPerAcre: "0.00",
    targetUtilizationPercent: 0,
    targetRestDays: 7,
  });
  const horseStallId = await ensureLandUnit({
    ranchId,
    name: "Horse Stall A",
    code: "STA-A",
    unitType: "stall",
    acreage: "0.20",
    grazeableAcreage: "0.00",
    estimatedForageLbsPerAcre: "0.00",
    targetUtilizationPercent: 0,
    targetRestDays: 0,
  });

  const cowAId = await ensureAnimal({
    ranchId,
    internalId: "COW-204",
    tagId: "204",
    displayName: null,
    species: "cattle",
    sex: "female",
    animalClass: "cow",
    breed: "Angus",
  });
  const cowBId = await ensureAnimal({
    ranchId,
    internalId: "HEIFER-117",
    tagId: "117",
    displayName: null,
    species: "cattle",
    sex: "female",
    animalClass: "heifer",
    breed: "Angus",
  });
  const horseId = await ensureAnimal({
    ranchId,
    internalId: "HORSE-01",
    tagId: "H-01",
    displayName: "Scout",
    species: "horse",
    sex: "male",
    animalClass: "gelding",
    breed: "Quarter Horse",
  });

  await ensureAnimalAssignment({
    ranchId,
    animalId: cowAId,
    landUnitId: northPastureId,
    assignedByMembershipId: managerMembershipId,
  });
  await ensureAnimalAssignment({
    ranchId,
    animalId: cowBId,
    landUnitId: northPastureId,
    assignedByMembershipId: managerMembershipId,
  });
  await ensureAnimalAssignment({
    ranchId,
    animalId: horseId,
    landUnitId: mainCorralId,
    assignedByMembershipId: managerMembershipId,
  });
  await ensureAnimalAssignment({
    ranchId,
    animalId: horseId,
    landUnitId: horseStallId,
    assignedByMembershipId: managerMembershipId,
  });

  await ensureGrazingPeriod({
    ranchId,
    landUnitId: northPastureId,
    createdByMembershipId: managerMembershipId,
    animalIds: [cowAId, cowBId],
  });

  await ensureProtocolTemplate({
    ranchId,
    name: "Cow Herd Vaccine Cadence",
    protocolType: "vaccination",
    intervalDays: 120,
    dueSoonDays: 14,
  });
  await ensureProtocolTemplate({
    ranchId,
    name: "Cow Herd Deworming",
    protocolType: "deworming",
    intervalDays: 90,
    dueSoonDays: 10,
  });
  await ensureProtocolTemplate({
    ranchId,
    name: "Post-breeding Pregnancy Check",
    protocolType: "pregnancy_check",
    intervalDays: 45,
    dueSoonDays: 7,
  });

  await ensureAnimalEvent({
    ranchId,
    animalId: cowAId,
    eventType: "breeding",
    summary: "Breeding/service recorded · outcome: confirmed",
    daysAgo: 55,
    eventData: {
      outcome: "confirmed",
      expectedBirthDate: new Date(Date.now() + 160 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
    },
  });
  await ensureAnimalEvent({
    ranchId,
    animalId: cowAId,
    eventType: "pregnancy_check",
    summary: "Pregnancy check: confirmed.",
    daysAgo: 20,
    eventData: {
      outcome: "confirmed",
      expectedBirthDate: new Date(Date.now() + 125 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
    },
  });
  await ensureAnimalEvent({
    ranchId,
    animalId: cowAId,
    eventType: "vaccination",
    summary: "Vaccination: Clostridial booster",
    daysAgo: 100,
    eventData: { healthRecordType: "vaccination" },
  });
  await ensureAnimalEvent({
    ranchId,
    animalId: cowBId,
    eventType: "deworming",
    summary: "Deworming: Spring treatment",
    daysAgo: 92,
    eventData: { healthRecordType: "deworming" },
  });
  await ensureAnimalEvent({
    ranchId,
    animalId: horseId,
    eventType: "treatment",
    summary: "Treatment: Hoof abscess follow-up",
    daysAgo: 12,
    eventData: { healthRecordType: "treatment" },
  });
  await ensureAnimalEvent({
    ranchId,
    animalId: horseId,
    eventType: "movement",
    summary: "Moved to Horse Stall A from Main Corral.",
    daysAgo: 6,
  });

  console.log("Demo seed complete.");
  console.log("Owner login: owner@demoranch.local");
  console.log(`Password: ${demoPassword}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
