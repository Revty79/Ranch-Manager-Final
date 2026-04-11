import { NextResponse } from "next/server";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  animalLocationAssignments,
  animals,
  grazingPeriods,
  ranchMemberships,
  shifts,
  workOrders,
} from "@/lib/db/schema";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ranchId = searchParams.get("ranchId");

  if (!ranchId) {
    return NextResponse.json({ error: "Missing ranchId" }, { status: 400 });
  }

  try {
    const [
      activeCrewRow,
      openWorkOrdersRow,
      activeShiftsRow,
      activeAnimalsRow,
      dueItemsCount,
      occupiedUnitsRow,
      activeGrazingRow,
    ] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(ranchMemberships)
        .where(and(eq(ranchMemberships.ranchId, ranchId), eq(ranchMemberships.isActive, true))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(workOrders)
        .where(and(eq(workOrders.ranchId, ranchId), inArray(workOrders.status, ["draft", "open", "in_progress"]))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(shifts)
        .where(and(eq(shifts.ranchId, ranchId), isNull(shifts.endedAt))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(animals)
        .where(and(eq(animals.ranchId, ranchId), eq(animals.status, "active"))),
      // Simplified due count for now
      Promise.resolve(0),
      db
        .select({ count: sql<number>`count(distinct ${animalLocationAssignments.landUnitId})::int` })
        .from(animalLocationAssignments)
        .where(and(eq(animalLocationAssignments.ranchId, ranchId), eq(animalLocationAssignments.isActive, true))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(grazingPeriods)
        .where(and(eq(grazingPeriods.ranchId, ranchId), eq(grazingPeriods.status, "active"))),
    ]);

    return NextResponse.json({
      activeCrewCount: activeCrewRow[0]?.count ?? 0,
      openWorkOrdersCount: openWorkOrdersRow[0]?.count ?? 0,
      activeShiftsCount: activeShiftsRow[0]?.count ?? 0,
      totalPayrollCents: 0, // Restricted for mobile-v1
      activeAnimalsCount: activeAnimalsRow[0]?.count ?? 0,
      dueAttentionCount: dueItemsCount,
      occupiedUnitsCount: occupiedUnitsRow[0]?.count ?? 0,
      activeGrazingCount: activeGrazingRow[0]?.count ?? 0,
    });
  } catch (error) {
    console.error("Android Dashboard API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
