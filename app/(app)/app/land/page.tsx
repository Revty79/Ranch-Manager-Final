import Link from "next/link";
import { MapPinned } from "lucide-react";
import { CreateLandUnitForm } from "@/components/land/create-land-unit-form";
import { EmptyState } from "@/components/patterns/empty-state";
import { PageHeader } from "@/components/patterns/page-header";
import { StatCard } from "@/components/patterns/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { roleCanManageOperations, requirePaidAccessContext } from "@/lib/auth/context";
import { formatLandUnitType, landUnitTypeOptions } from "@/lib/land/constants";
import {
  getLandUnitsForRanch,
  getLandUnitSummary,
  resolveLandUnitFilters,
} from "@/lib/land/queries";

function formatAcreage(value: string | null): string {
  if (!value) return "—";
  return `${Number.parseFloat(value).toFixed(2)} ac`;
}

function formatDays(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "â€”";
  return `${value.toFixed(1)} days`;
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function statusVariant(isActive: boolean) {
  return isActive ? "success" : "neutral";
}

export default async function LandPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; unitType?: string; activity?: string }>;
}) {
  const context = await requirePaidAccessContext();
  const params = await searchParams;
  const filters = resolveLandUnitFilters(params);
  const canManage = roleCanManageOperations(context.membership.role);

  const [units, summary] = await Promise.all([
    getLandUnitsForRanch(context.ranch.id, filters),
    getLandUnitSummary(context.ranch.id),
  ]);

  const hasFilters =
    filters.search.length > 0 || filters.unitType !== "all" || filters.activity !== "all";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Land"
        title="Land Units"
        description="One shared model for pastures, lots, corrals, pens, stalls, and horse-friendly occupancy workflows."
        actions={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href="/app/land/export?type=occupancy"
                className="rounded-xl border bg-surface px-3 py-2 text-sm font-semibold text-foreground-muted hover:bg-accent-soft hover:text-foreground"
              >
                Export occupancy CSV
              </Link>
              <Link
                href="/app/land/export?type=movement"
                className="rounded-xl border bg-surface px-3 py-2 text-sm font-semibold text-foreground-muted hover:bg-accent-soft hover:text-foreground"
              >
                Export movement CSV
              </Link>
            </div>
          ) : null
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total units" value={`${summary.totalUnits}`} trend="All configured spaces" />
        <StatCard label="Active units" value={`${summary.activeUnits}`} trend="Ready for occupancy" />
        <StatCard
          label="Handling spaces"
          value={`${summary.handlingUnits}`}
          trend="Corrals, pens, stalls, barn/holding"
        />
        <StatCard label="Occupied now" value={`${summary.occupiedUnits}`} trend="Units with active occupants" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardContent className="space-y-4 py-6">
            <div>
              <CardTitle className="text-base">Filter land units</CardTitle>
              <CardDescription>
                Search by name/code, then narrow by type or active status.
              </CardDescription>
            </div>
            <form className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm md:col-span-2">
                <span className="text-foreground-muted">Search</span>
                <input
                  name="q"
                  defaultValue={filters.search}
                  placeholder="North Pasture, COR-3..."
                  className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-foreground-muted">Unit type</span>
                <select
                  name="unitType"
                  defaultValue={filters.unitType}
                  className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
                >
                  <option value="all">All unit types</option>
                  {landUnitTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-foreground-muted">Activity</span>
                <select
                  name="activity"
                  defaultValue={filters.activity}
                  className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <div className="md:col-span-2 flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-white"
                >
                  Apply filters
                </button>
                <Link
                  href="/app/land"
                  className="inline-flex h-10 items-center rounded-xl border bg-surface-strong px-4 text-sm font-semibold text-foreground-muted hover:bg-accent-soft"
                >
                  Reset
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 py-6">
            <div>
              <CardTitle className="text-base">Add land unit</CardTitle>
              <CardDescription>
                Define pasture-scale and handling-scale spaces with optional grazing planning inputs.
              </CardDescription>
            </div>
            {canManage ? (
              <CreateLandUnitForm />
            ) : (
              <p className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
                Owners and managers can create land units. Your role is{" "}
                <span className="font-semibold text-foreground">{context.membership.role}</span>.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Land unit inventory</h2>
          <p className="text-sm text-foreground-muted">
            Occupancy counts update from active movement assignments. Grazing planning continues in
            <Link href="/app/land/grazing" className="ml-1 font-semibold text-accent hover:underline">
              /app/land/grazing
            </Link>.
          </p>
        </div>
        {units.length ? (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell>Type</TableHeaderCell>
                  <TableHeaderCell>Acreage</TableHeaderCell>
                  <TableHeaderCell>Grazeable</TableHeaderCell>
                  <TableHeaderCell>Occupancy</TableHeaderCell>
                  <TableHeaderCell>Max graze days</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell className="text-right">Actions</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {units.map((unit) => (
                  <TableRow key={unit.id}>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="font-semibold">{unit.name}</p>
                        <p className="text-xs text-foreground-muted">{unit.code ?? "No code"}</p>
                      </div>
                    </TableCell>
                    <TableCell>{formatLandUnitType(unit.unitType)}</TableCell>
                    <TableCell>{formatAcreage(unit.acreage)}</TableCell>
                    <TableCell>{formatAcreage(unit.grazeableAcreage)}</TableCell>
                    <TableCell>
                      <div className="space-y-0.5 text-sm">
                        <p>{unit.occupancyCount} total</p>
                        <p className="text-xs text-foreground-muted">{unit.horseOccupancyCount} horses</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {unit.currentLoadGrazingEstimate.canEstimate ? (
                        <div className="space-y-0.5 text-sm">
                          <p>{formatDays(unit.currentLoadGrazingEstimate.estimatedGrazingDays)}</p>
                          <p className="text-xs text-foreground-muted">
                            move by{" "}
                            {unit.currentLoadGrazingEstimate.projectedMoveDate
                              ? formatDate(unit.currentLoadGrazingEstimate.projectedMoveDate)
                              : "not set"}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-foreground-muted">
                          Need {unit.currentLoadGrazingEstimate.missingInputs.join(", ")}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(unit.isActive)}>
                        {unit.isActive ? "active" : "inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/app/land/${unit.id}`}
                        className="rounded-lg border px-2.5 py-1 text-xs font-semibold text-foreground-muted hover:bg-accent-soft hover:text-foreground"
                      >
                        Open
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <EmptyState
            title={hasFilters ? "No land units match these filters" : "No land units yet"}
            description={
              hasFilters
                ? "Try broader filters or clear your search."
                : "Add your first pasture, lot, corral, pen, or stall above."
            }
            icon={<MapPinned className="h-5 w-5 text-accent" />}
          />
        )}
      </section>
    </div>
  );
}
