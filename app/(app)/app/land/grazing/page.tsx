import Link from "next/link";
import { Leaf, SlidersHorizontal } from "lucide-react";
import { CompleteGrazingPeriodForm } from "@/components/grazing/complete-grazing-period-form";
import { CreateGrazingPeriodForm } from "@/components/grazing/create-grazing-period-form";
import { GrazingAssumptionsForm } from "@/components/grazing/grazing-assumptions-form";
import { GrazingUnitOccupancyForm } from "@/components/grazing/grazing-unit-occupancy-form";
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
import type { AnimalSpecies } from "@/lib/db/schema";
import {
  computeGrazingEstimateFromSpeciesCounts,
  getGrazingWorkspace,
} from "@/lib/grazing/queries";
import { animalSpeciesOptions, formatAnimalSpecies } from "@/lib/herd/constants";

type GrazingSearchParams = Record<string, string | string[] | undefined>;
const MS_PER_HOUR = 60 * 60 * 1000;
const MOVE_SOON_HOURS = 72;

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatEstimateNumber(value: number | null, decimals = 1): string {
  if (value == null || !Number.isFinite(value)) return "--";
  return value.toFixed(decimals);
}

function daysUntil(date: Date): number {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return Math.floor((target - start) / (24 * 60 * 60 * 1000));
}

function hoursUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / MS_PER_HOUR);
}

function describeMoveCountdown(date: Date): {
  label: string;
  variant: "danger" | "warning" | "neutral";
} {
  const hours = hoursUntil(date);
  if (hours <= 0) {
    const overdueHours = Math.abs(hours);
    if (overdueHours === 0) return { label: "move now", variant: "danger" };
    if (overdueHours < 24) return { label: `${overdueHours}h overdue`, variant: "danger" };
    return { label: `${Math.ceil(overdueHours / 24)}d overdue`, variant: "danger" };
  }
  if (hours < 24) return { label: `in ${hours}h`, variant: "warning" };
  if (hours <= MOVE_SOON_HOURS) return { label: `in ${Math.ceil(hours / 24)}d`, variant: "warning" };
  return { label: `in ${Math.ceil(hours / 24)}d`, variant: "neutral" };
}

function toParamValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function countParamName(species: AnimalSpecies): string {
  return `calc_count_${species}`;
}

function parseHeadCount(value: string): number {
  if (!value.trim()) return 0;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

function validDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export default async function LandGrazingPage({
  searchParams,
}: {
  searchParams: Promise<GrazingSearchParams>;
}) {
  const context = await requirePaidAccessContext();
  const params = await searchParams;
  const canManage = roleCanManageOperations(context.membership.role);
  const workspace = await getGrazingWorkspace(context.ranch.id);

  const activeCount = workspace.activePeriods.length;
  const restingCount = workspace.restRows.filter((row) => row.state === "resting").length;
  const moveSignals = workspace.activePeriods
    .map((period) => {
      const moveDate = period.plannedMoveOn
        ? new Date(`${period.plannedMoveOn}T00:00:00Z`)
        : period.estimate.projectedMoveDate;
      if (!moveDate) return null;
      return { period, moveDate, hours: hoursUntil(moveDate) };
    })
    .filter((row): row is { period: (typeof workspace.activePeriods)[number]; moveDate: Date; hours: number } => Boolean(row));
  const rotationSoonCount = moveSignals.filter(
    (row) => row.hours > 0 && row.hours <= MOVE_SOON_HOURS,
  ).length;
  const moveNowCount = moveSignals.filter((row) => row.hours <= 0).length;
  const overdueRotations = moveSignals.filter((row) => row.hours < 0).length;
  const dueNowAlerts = moveSignals.filter((row) => row.hours <= 0).sort((a, b) => a.hours - b.hours);

  const defaultCalcLandUnitId = workspace.formOptions.landUnits[0]?.id ?? "";
  const calcLandUnitId = toParamValue(params.calcLandUnitId) || defaultCalcLandUnitId;
  const calcStartedOnRaw = toParamValue(params.calcStartedOn);
  const calcStartedOn = validDateKey(calcStartedOnRaw) ? calcStartedOnRaw : todayDateKey();
  const calcSelectedLandUnit =
    workspace.formOptions.landUnits.find((unit) => unit.id === calcLandUnitId) ?? null;

  const calcSpeciesCounts: Partial<Record<AnimalSpecies, number>> = {};
  for (const option of animalSpeciesOptions) {
    const fieldName = countParamName(option.value);
    calcSpeciesCounts[option.value] = parseHeadCount(toParamValue(params[fieldName]));
  }

  const calcTotalHeadcount = Object.values(calcSpeciesCounts).reduce(
    (total, count) => total + (count ?? 0),
    0,
  );

  const calcMixLabel = animalSpeciesOptions
    .map((option) => ({
      label: option.label,
      count: calcSpeciesCounts[option.value] ?? 0,
    }))
    .filter((entry) => entry.count > 0)
    .map((entry) => `${entry.label}: ${entry.count}`)
    .join(", ");

  const calcHasInput =
    Boolean(toParamValue(params.calcLandUnitId)) ||
    Boolean(toParamValue(params.calcStartedOn)) ||
    calcTotalHeadcount > 0;

  const calcEstimate = calcSelectedLandUnit
    ? computeGrazingEstimateFromSpeciesCounts({
        startedOn: calcStartedOn,
        grazeableAcreage: calcSelectedLandUnit.grazeableAcreage,
        estimatedForageLbsPerAcre: calcSelectedLandUnit.estimatedForageLbsPerAcre,
        unitUtilizationPercent: calcSelectedLandUnit.targetUtilizationPercent,
        speciesCounts: calcSpeciesCounts,
        assumptions: workspace.assumptions,
      })
    : null;

  const calcProjectedDays =
    calcEstimate?.projectedMoveDate != null ? daysUntil(calcEstimate.projectedMoveDate) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Land"
        title="Grazing Rotation & Rest Planning"
        description="Plan grazing periods, track rest windows, and review transparent planning estimates built from ranch-configurable assumptions."
        actions={
          canManage ? (
            <Link
              href="/app/land/export?type=grazing_rest"
              className="rounded-xl border bg-surface px-3 py-2 text-sm font-semibold text-foreground-muted hover:bg-accent-soft hover:text-foreground"
            >
              Export grazing/rest CSV
            </Link>
          ) : null
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active/Planned Grazings" value={`${activeCount}`} trend="Units currently in use or queued" />
        <StatCard label="Resting Units" value={`${restingCount}`} trend="No active grazing period" />
        <StatCard label="Move Soon (72h)" value={`${rotationSoonCount}`} trend="Projected move deadline in next 3 days" />
        <StatCard
          label="Move Now / Overdue"
          value={`${moveNowCount}`}
          trend={overdueRotations ? `${overdueRotations} already overdue` : "No overdue units"}
        />
      </section>

      {dueNowAlerts.length ? (
        <section>
          <Card>
            <CardContent className="space-y-3 py-6">
              <CardTitle className="text-base text-danger">Move Animals Now</CardTitle>
              <CardDescription>
                These units have reached or passed projected move time based on current load and forage assumptions.
              </CardDescription>
              <ul className="space-y-2">
                {dueNowAlerts.slice(0, 8).map((alert) => (
                  <li key={`${alert.period.periodId}-${alert.period.landUnitId}`} className="rounded-lg border bg-surface px-3 py-2 text-sm">
                    <Link href={`/app/land/${alert.period.landUnitId}`} className="font-semibold text-accent hover:underline">
                      {alert.period.landUnitName}
                    </Link>
                    <p className="text-foreground-muted">
                      Move by {formatDateTime(alert.moveDate)} ({describeMoveCountdown(alert.moveDate).label})
                    </p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardContent className="space-y-4 py-6">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-accent" />
              <CardTitle className="text-base">Ranch assumptions</CardTitle>
            </div>
            <CardDescription>
              Estimates are planning tools, not agronomic guarantees. No hidden formulas: this
              page uses your entered forage inputs, utilization target, and demand multipliers.
            </CardDescription>
            {canManage ? (
              <GrazingAssumptionsForm assumptions={workspace.assumptions} />
            ) : (
              <p className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
                Owners and managers can edit assumptions. Your role is{" "}
                <span className="font-semibold text-foreground">{context.membership.role}</span>.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 py-6">
            <div className="flex items-center gap-2">
              <Leaf className="h-4 w-4 text-accent" />
              <CardTitle className="text-base">Record grazing period</CardTitle>
            </div>
            <CardDescription>
              Log start/end windows, optional animal/group linkage, and planned move dates even
              when estimate inputs are incomplete.
            </CardDescription>
            {canManage ? (
              <CreateGrazingPeriodForm options={workspace.formOptions} />
            ) : (
              <p className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
                Owners and managers can record grazing periods.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardContent className="space-y-4 py-6">
            <div>
              <CardTitle className="text-base">Move Animals On/Off Grazing Units</CardTitle>
              <CardDescription>
                Record live occupancy moves directly from grazing operations without leaving this
                page.
              </CardDescription>
            </div>
            {canManage ? (
              workspace.formOptions.landUnits.length ? (
                <GrazingUnitOccupancyForm
                  landUnits={workspace.formOptions.landUnits}
                  animals={workspace.formOptions.animals}
                  occupancyAssignments={workspace.formOptions.occupancyAssignments}
                />
              ) : (
                <p className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
                  Add at least one active land unit before recording occupancy moves.
                </p>
              )
            ) : (
              <p className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
                Owners and managers can record occupancy moves.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardContent className="space-y-4 py-6">
            <div>
              <CardTitle className="text-base">Grazing cell capacity calculator</CardTitle>
              <CardDescription>
                Estimate how many days a selected cell can feed a planned species mix before you
                rotate.
              </CardDescription>
            </div>

            <form method="get" className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-foreground-muted">Cell / land unit</span>
                <select
                  name="calcLandUnitId"
                  defaultValue={calcLandUnitId}
                  className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
                >
                  {workspace.formOptions.landUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name} ({unit.unitType.replace("_", " ")})
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-foreground-muted">Planned start date</span>
                <input
                  type="date"
                  name="calcStartedOn"
                  defaultValue={calcStartedOn}
                  className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
                />
              </label>

              <div className="md:col-span-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {animalSpeciesOptions.map((option) => (
                  <label key={option.value} className="space-y-1 text-sm">
                    <span className="text-foreground-muted">{option.label} headcount</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      name={countParamName(option.value)}
                      defaultValue={calcSpeciesCounts[option.value] ?? 0}
                      className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
                    />
                  </label>
                ))}
              </div>

              <div className="md:col-span-2 flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-white"
                >
                  Calculate capacity
                </button>
                <Link
                  href="/app/land/grazing"
                  className="inline-flex h-10 items-center rounded-xl border bg-surface-strong px-4 text-sm font-semibold text-foreground-muted hover:bg-accent-soft"
                >
                  Reset
                </Link>
              </div>
            </form>

            {calcSelectedLandUnit ? (
              calcHasInput ? (
                calcEstimate?.canEstimate ? (
                  <div className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
                    <p className="font-semibold text-foreground">
                      {calcSelectedLandUnit.name}: about{" "}
                      {formatEstimateNumber(calcEstimate.estimatedGrazingDays, 1)} grazing days
                    </p>
                    <p>
                      Projected move date:{" "}
                      {calcEstimate.projectedMoveDate
                        ? formatDate(calcEstimate.projectedMoveDate.toISOString().slice(0, 10))
                        : "not available"}
                      {calcProjectedDays != null
                        ? calcProjectedDays < 0
                          ? ` (${Math.abs(calcProjectedDays)}d overdue)`
                          : ` (${calcProjectedDays}d left)`
                        : ""}
                    </p>
                    <p>
                      Available forage: {formatEstimateNumber(calcEstimate.availableForageLbs, 0)} lbs
                      {" · "}
                      Demand/day: {formatEstimateNumber(calcEstimate.demandPerDayLbs, 0)} lbs
                    </p>
                    <p>{calcMixLabel || "No species mix entered."}</p>
                  </div>
                ) : (
                  <p className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
                    Missing: {calcEstimate?.missingInputs.join(", ")}
                  </p>
                )
              ) : (
                <p className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
                  Enter headcounts to calculate how long this unit can feed your planned mix.
                </p>
              )
            ) : (
              <p className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
                Add at least one active land unit to use the capacity calculator.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Current use and projected rotation</h2>
          <p className="text-sm text-foreground-muted">
            Estimate rows show assumptions and missing inputs clearly when precision is limited.
          </p>
        </div>
        {workspace.activePeriods.length ? (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Land unit</TableHeaderCell>
                  <TableHeaderCell>Period</TableHeaderCell>
                  <TableHeaderCell>Participants</TableHeaderCell>
                  <TableHeaderCell>Estimate snapshot</TableHeaderCell>
                  <TableHeaderCell>Projected move</TableHeaderCell>
                  <TableHeaderCell>Time left</TableHeaderCell>
                  <TableHeaderCell className="text-right">Actions</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {workspace.activePeriods.map((period) => {
                  const projectedDate = period.plannedMoveOn
                    ? new Date(`${period.plannedMoveOn}T00:00:00Z`)
                    : period.estimate.projectedMoveDate;
                  const countdown = projectedDate ? describeMoveCountdown(projectedDate) : null;

                  return (
                    <TableRow key={period.periodId}>
                      <TableCell>
                        <Link href={`/app/land/${period.landUnitId}`} className="font-semibold text-accent hover:underline">
                          {period.landUnitName}
                        </Link>
                        <p className="text-xs text-foreground-muted">{period.unitType.replace("_", " ")}</p>
                      </TableCell>
                      <TableCell>
                        <p>
                          Start:{" "}
                          {period.startedAt && period.source === "occupancy_estimate"
                            ? formatDateTime(period.startedAt)
                            : formatDate(period.startedOn)}
                        </p>
                        {period.source === "occupancy_estimate" ? (
                          <p className="text-xs text-foreground-muted">derived from active occupancy</p>
                        ) : null}
                        <p className="text-xs text-foreground-muted">status: {period.status}</p>
                      </TableCell>
                      <TableCell>
                        <p>{period.participantCount} linked/active animals</p>
                        <p className="text-xs text-foreground-muted">
                          {period.participantLabels.length
                            ? period.participantLabels.join(", ")
                            : "No explicit linked animals"}
                        </p>
                        <p className="text-xs text-foreground-muted">
                          {period.participantSpeciesMix.length
                            ? period.participantSpeciesMix
                                .map((entry) => `${formatAnimalSpecies(entry.species)} ${entry.count}`)
                                .join(", ")
                            : "No species mix available"}
                        </p>
                      </TableCell>
                      <TableCell>
                        {period.estimate.canEstimate ? (
                          <div className="space-y-1 text-xs text-foreground-muted">
                            <p>Avail forage: {formatEstimateNumber(period.estimate.availableForageLbs, 0)} lbs</p>
                            <p>Demand/day: {formatEstimateNumber(period.estimate.demandPerDayLbs, 0)} lbs</p>
                            <p>Est grazing: {formatEstimateNumber(period.estimate.estimatedGrazingDays, 1)} days</p>
                          </div>
                        ) : (
                          <p className="text-xs text-foreground-muted">
                            Missing: {period.estimate.missingInputs.join(", ")}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {projectedDate ? (
                          <div className="space-y-1">
                            <p>{formatDateTime(projectedDate)}</p>
                            {countdown != null ? (
                              <Badge variant={countdown.variant}>
                                {countdown.label}
                              </Badge>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-foreground-muted">No move estimate yet</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {countdown == null ? (
                          <span className="text-xs text-foreground-muted">No estimate</span>
                        ) : (
                          <Badge variant={countdown.variant}>
                            {countdown.label}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {canManage &&
                        period.status !== "completed" &&
                        period.source === "recorded_period" ? (
                          <CompleteGrazingPeriodForm
                            grazingPeriodId={period.periodId}
                            defaultEndedOn={todayDateKey()}
                          />
                        ) : period.source === "occupancy_estimate" ? (
                          <span className="text-xs text-foreground-muted">Use occupancy move controls</span>
                        ) : (
                          <span className="text-xs text-foreground-muted">View only</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <EmptyState
            title="No active grazing use"
            description="Record a grazing period or move animals onto a unit to start move alerts."
            icon={<Leaf className="h-5 w-5 text-accent" />}
          />
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 py-6">
            <CardTitle className="text-base">Rest tracking</CardTitle>
            {workspace.restRows.length ? (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Unit</TableHeaderCell>
                      <TableHeaderCell>State</TableHeaderCell>
                      <TableHeaderCell>Rest started</TableHeaderCell>
                      <TableHeaderCell>Days resting</TableHeaderCell>
                      <TableHeaderCell>Ready to graze</TableHeaderCell>
                      <TableHeaderCell>Target rest</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {workspace.restRows.map((row) => (
                      <TableRow key={row.landUnitId}>
                        <TableCell>
                          <Link href={`/app/land/${row.landUnitId}`} className="font-semibold text-accent hover:underline">
                            {row.landUnitName}
                          </Link>
                        </TableCell>
                        <TableCell>{row.state.replace("_", " ")}</TableCell>
                        <TableCell>
                          {row.restStartedAt ? (
                            <span className="text-sm text-foreground-muted">
                              {formatDateTime(row.restStartedAt)}
                            </span>
                          ) : (
                            <span className="text-xs text-foreground-muted">--</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {row.daysResting == null ? "--" : `${row.daysResting.toFixed(1)}d`}
                        </TableCell>
                        <TableCell>
                          {row.readyAt ? (
                            <div className="space-y-0.5">
                              <p>{formatDateTime(row.readyAt)}</p>
                              {row.hoursUntilReady != null ? (
                                <p className="text-xs text-foreground-muted">
                                  {row.restComplete
                                    ? "ready now"
                                    : `${row.hoursUntilReady}h until ready`}
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs text-foreground-muted">--</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {row.targetRestDays}d
                          {row.restComplete != null ? (
                            <span className="text-xs text-foreground-muted">
                              {" "}
                              ({row.restComplete ? "met" : "not met"})
                            </span>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <p className="text-sm text-foreground-muted">No rest-tracking data yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 py-6">
            <CardTitle className="text-base">Recent grazing periods</CardTitle>
            {workspace.recentPeriods.length ? (
              <ul className="space-y-2 text-sm text-foreground-muted">
                {workspace.recentPeriods.map((period) => (
                  <li key={period.periodId} className="rounded-lg border bg-surface px-3 py-2">
                    <Link href={`/app/land/${period.landUnitId}`} className="font-semibold text-accent hover:underline">
                      {period.landUnitName}
                    </Link>
                    <p>
                      {formatDate(period.startedOn)}
                      {period.endedOn ? ` to ${formatDate(period.endedOn)}` : " to current"}
                    </p>
                    <p>status: {period.status}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-foreground-muted">No grazing history yet.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

