import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db } from "../lib/db/client";
import { hashPassword } from "../lib/auth/password";
import {
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

  console.log("Demo seed complete.");
  console.log("Owner login: owner@demoranch.local");
  console.log(`Password: ${demoPassword}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
