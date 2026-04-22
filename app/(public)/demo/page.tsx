import Link from "next/link";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { Eye, ShieldCheck } from "lucide-react";
import { PublicDemoEntryForm } from "@/components/auth/public-demo-entry-form";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentRanchContext, getCurrentUser } from "@/lib/auth/context";
import { db } from "@/lib/db/client";
import {
  animalLocationAssignments,
  animals,
  grazingPeriods,
  ranchMemberships,
  ranches,
  shifts,
  workOrders,
} from "@/lib/db/schema";
import { getProtocolDueItemsForRanch } from "@/lib/herd/protocol-queries";
import { getPublicDemoConfig } from "@/lib/demo/public";
import { cn } from "@/lib/utils";

export default async function PublicDemoPage() {
  const config = getPublicDemoConfig();
  const currentUser = await getCurrentUser();
  const currentRanchContext = currentUser ? await getCurrentRanchContext() : null;
  const alreadyInDemo = currentRanchContext?.ranch.slug === config.ranchSlug;

  const [demoRanch] = await db
    .select({
      id: ranches.id,
      name: ranches.name,
      slug: ranches.slug,
    })
    .from(ranches)
    .where(eq(ranches.slug, config.ranchSlug))
    .limit(1);

  const snapshot = demoRanch
    ? await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(ranchMemberships)
          .where(
            and(
              eq(ranchMemberships.ranchId, demoRanch.id),
              eq(ranchMemberships.isActive, true),
            ),
          ),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(workOrders)
          .where(
            and(
              eq(workOrders.ranchId, demoRanch.id),
              inArray(workOrders.status, ["draft", "open", "in_progress"]),
            ),
          ),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(shifts)
          .where(and(eq(shifts.ranchId, demoRanch.id), isNull(shifts.endedAt))),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(animals)
          .where(and(eq(animals.ranchId, demoRanch.id), eq(animals.status, "active"))),
        db
          .select({
            count: sql<number>`count(distinct ${animalLocationAssignments.landUnitId})::int`,
          })
          .from(animalLocationAssignments)
          .where(
            and(
              eq(animalLocationAssignments.ranchId, demoRanch.id),
              eq(animalLocationAssignments.isActive, true),
            ),
          ),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(grazingPeriods)
          .where(
            and(
              eq(grazingPeriods.ranchId, demoRanch.id),
              inArray(grazingPeriods.status, ["active", "planned"]),
            ),
          ),
        getProtocolDueItemsForRanch(demoRanch.id, { limit: 300 }),
      ])
    : null;

  const activeCrewCount = snapshot?.[0]?.[0]?.count ?? 0;
  const openWorkCount = snapshot?.[1]?.[0]?.count ?? 0;
  const activeShiftCount = snapshot?.[2]?.[0]?.count ?? 0;
  const activeAnimalCount = snapshot?.[3]?.[0]?.count ?? 0;
  const occupiedUnitsCount = snapshot?.[4]?.[0]?.count ?? 0;
  const activeGrazingCount = snapshot?.[5]?.[0]?.count ?? 0;
  const dueAttentionCount =
    snapshot?.[6].filter((item) => item.dueState === "due_soon" || item.dueState === "overdue")
      .length ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
          Interactive Demo
        </p>
        <h1 className="font-display text-4xl font-semibold">View Demo Ranch</h1>
        <p className="max-w-3xl text-foreground-muted">
          Step into a preloaded ranch workspace with realistic crew, work, herd, land, and
          grazing data so you can understand daily value in minutes.
        </p>
      </header>

      <Card className="border-accent/35">
        <CardContent className="space-y-4 py-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-accent" />
            <CardTitle className="text-base">Safe demo access</CardTitle>
          </div>
          <CardDescription>
            Public demo entry uses a non-owner demo account. Admin controls and owner billing
            actions are not exposed through this path.
          </CardDescription>
          {alreadyInDemo ? (
            <div className="space-y-3">
              <p className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
                You are already signed into the demo ranch.
              </p>
              <Link href="/app" className={cn(buttonVariants(), "w-full sm:w-auto")}>
                Open Demo Dashboard
              </Link>
            </div>
          ) : config.enabled && demoRanch ? (
            <div className="max-w-sm">
              <PublicDemoEntryForm />
            </div>
          ) : (
            <p className="rounded-xl border bg-warning/10 px-4 py-3 text-sm text-warning">
              Demo access is currently unavailable. Ask the operator to enable public demo and run
              the demo seed.
            </p>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="space-y-1 py-5">
            <p className="text-xs uppercase tracking-[0.12em] text-foreground-muted">Crew</p>
            <p className="font-display text-2xl font-semibold">{activeCrewCount}</p>
            <p className="text-xs text-foreground-muted">Active team members</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 py-5">
            <p className="text-xs uppercase tracking-[0.12em] text-foreground-muted">Work</p>
            <p className="font-display text-2xl font-semibold">{openWorkCount}</p>
            <p className="text-xs text-foreground-muted">Open work orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 py-5">
            <p className="text-xs uppercase tracking-[0.12em] text-foreground-muted">Herd</p>
            <p className="font-display text-2xl font-semibold">{activeAnimalCount}</p>
            <p className="text-xs text-foreground-muted">Active animals</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 py-5">
            <p className="text-xs uppercase tracking-[0.12em] text-foreground-muted">Land</p>
            <p className="font-display text-2xl font-semibold">{occupiedUnitsCount}</p>
            <p className="text-xs text-foreground-muted">Occupied land units</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardContent className="space-y-3 py-6">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-accent" />
              <CardTitle className="text-base">What to check first in the demo</CardTitle>
            </div>
            <ul className="space-y-2 text-sm text-foreground-muted">
              <li>
                Open <span className="font-semibold text-foreground">Dashboard</span> for live
                crew, work, herd, and grazing summary.
              </li>
              <li>
                Open <span className="font-semibold text-foreground">Work Orders</span> to see
                assignment, status flow, and manager review.
              </li>
              <li>
                Open <span className="font-semibold text-foreground">Time</span> to view active
                shift/task tracking and session history.
              </li>
              <li>
                Open <span className="font-semibold text-foreground">Herd</span> and{" "}
                <span className="font-semibold text-foreground">Land</span> for lifecycle,
                occupancy, movement, and due reminders.
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 py-6">
            <CardTitle className="text-base">Demo snapshot</CardTitle>
            <CardDescription>Current signals in the seeded demo ranch.</CardDescription>
            <div className="space-y-1 text-sm text-foreground-muted">
              <p>Active shifts: {activeShiftCount}</p>
              <p>Breeding/health due attention: {dueAttentionCount}</p>
              <p>Active/planned grazing periods: {activeGrazingCount}</p>
            </div>
            <p className="pt-2 text-xs text-foreground-muted">
              Demo ranch: {demoRanch?.name ?? config.ranchSlug}
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
