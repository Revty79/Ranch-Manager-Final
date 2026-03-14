import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock3, MapPin, MoveRight, Tractor } from "lucide-react";
import { BulkMoveAnimalsForm } from "@/components/land/bulk-move-animals-form";
import { EditLandUnitForm } from "@/components/land/edit-land-unit-form";
import { MoveAnimalForm } from "@/components/land/move-animal-form";
import { RemoveAnimalFromUnitForm } from "@/components/land/remove-animal-from-unit-form";
import { SplitHerdMoveForm } from "@/components/land/split-herd-move-form";
import { EmptyState } from "@/components/patterns/empty-state";
import { PageHeader } from "@/components/patterns/page-header";
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
import { getLandUnitGrazingHistory } from "@/lib/grazing/queries";
import { formatAnimalSpecies } from "@/lib/herd/constants";
import { formatLandUnitType, formatMovementReason } from "@/lib/land/constants";
import { getLandUnitProfile } from "@/lib/land/queries";

function formatAcreage(value: string | null): string {
  if (!value) return "Not set";
  return `${Number.parseFloat(value).toFixed(2)} ac`;
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
function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function preferredAnimalLabel({
  species,
  displayName,
  tagId,
}: {
  species: AnimalSpecies;
  displayName: string | null;
  tagId: string;
}): string {
  if (species === "horse" && displayName) {
    return `${displayName} (${tagId})`;
  }
  return `${tagId}${displayName ? ` - ${displayName}` : ""}`;
}

export default async function LandUnitDetailPage({
  params,
}: {
  params: Promise<{ landUnitId: string }>;
}) {
  const context = await requirePaidAccessContext();
  const { landUnitId } = await params;
  const canManage = roleCanManageOperations(context.membership.role);

  const profile = await getLandUnitProfile(context.ranch.id, landUnitId);
  if (!profile) notFound();
  const grazingHistory = await getLandUnitGrazingHistory(context.ranch.id, landUnitId);

  const {
    landUnit,
    currentOccupants,
    occupancyBySpecies,
    sourceAnimalClassOptions,
    movementHistory,
    movementAnimalOptions,
    destinationUnitOptions,
  } = profile;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Land Detail"
        title={landUnit.name}
        description="Land-unit identity, current occupancy, and movement history."
        actions={
          <Link
            href="/app/land"
            className="rounded-xl border bg-surface px-3 py-2 text-sm font-semibold text-foreground-muted hover:bg-accent-soft hover:text-foreground"
          >
            Back to land list
          </Link>
        }
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="space-y-3 py-6">
            <CardTitle className="text-base">Identity</CardTitle>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-foreground-muted">Code:</span> {landUnit.code ?? "Not set"}
              </p>
              <p>
                <span className="text-foreground-muted">Type:</span>{" "}
                {formatLandUnitType(landUnit.unitType)}
              </p>
              <p>
                <span className="text-foreground-muted">Acreage:</span> {formatAcreage(landUnit.acreage)}
              </p>
              <p>
                <span className="text-foreground-muted">Grazeable:</span>{" "}
                {formatAcreage(landUnit.grazeableAcreage)}
              </p>
              <p>
                <span className="text-foreground-muted">Forage lbs/acre:</span>{" "}
                {landUnit.estimatedForageLbsPerAcre ?? "Not set"}
              </p>
              <p>
                <span className="text-foreground-muted">Utilization target:</span>{" "}
                {landUnit.targetUtilizationPercent != null
                  ? `${landUnit.targetUtilizationPercent}%`
                  : "Not set"}
              </p>
              <p>
                <span className="text-foreground-muted">Rest target:</span>{" "}
                {landUnit.targetRestDays != null ? `${landUnit.targetRestDays} days` : "Not set"}
              </p>
            </div>
            <Badge variant={landUnit.isActive ? "success" : "neutral"}>
              {landUnit.isActive ? "active" : "inactive"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 py-6">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-accent" />
              <CardTitle className="text-base">Current occupancy</CardTitle>
            </div>
            <CardDescription>Who is here now based on active assignment records.</CardDescription>
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-foreground-muted">Total occupants:</span>{" "}
                <span className="font-semibold">{landUnit.occupancyCount}</span>
              </p>
              <p>
                <span className="text-foreground-muted">Horses:</span>{" "}
                <span className="font-semibold">{landUnit.horseOccupancyCount}</span>
              </p>
              <p className="text-foreground-muted">Species split:</p>
              {occupancyBySpecies.length ? (
                <ul className="space-y-0.5 text-xs text-foreground-muted">
                  {occupancyBySpecies.map((entry) => (
                    <li key={entry.species}>
                      {formatAnimalSpecies(entry.species)}:{" "}
                      <span className="font-semibold text-foreground">{entry.count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-foreground-muted">No active occupants yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 py-6">
            <div className="flex items-center gap-2">
              <Tractor className="h-4 w-4 text-accent" />
              <CardTitle className="text-base">Operational notes</CardTitle>
            </div>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-foreground-muted">Water:</span>{" "}
                {landUnit.waterSummary ?? "Not set"}
              </p>
              <p>
                <span className="text-foreground-muted">Fencing:</span>{" "}
                {landUnit.fencingSummary ?? "Not set"}
              </p>
              <p>
                <span className="text-foreground-muted">Seasonal notes:</span>{" "}
                {landUnit.seasonalNotes ?? "Not set"}
              </p>
              <p>
                <span className="text-foreground-muted">Notes:</span> {landUnit.notes ?? "Not set"}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardContent className="space-y-4 py-6">
            <div className="flex items-center gap-2">
              <MoveRight className="h-4 w-4 text-accent" />
              <CardTitle className="text-base">Move animals into this unit</CardTitle>
            </div>
            <CardDescription>
              Moves preserve history and update current occupancy immediately across herd and land views.
            </CardDescription>
            {canManage ? (
              landUnit.isActive ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Single-animal move</p>
                    <MoveAnimalForm landUnitId={landUnit.id} animalOptions={movementAnimalOptions} />
                  </div>
                  <div className="h-px bg-border" />
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Bulk move by species</p>
                    <BulkMoveAnimalsForm landUnitId={landUnit.id} />
                  </div>
                  <div className="h-px bg-border" />
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Split herd move from this unit</p>
                    <SplitHerdMoveForm
                      fromLandUnitId={landUnit.id}
                      destinationUnits={destinationUnitOptions}
                      animalClassOptions={sourceAnimalClassOptions}
                    />
                  </div>
                </div>
              ) : (
                <p className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
                  This land unit is inactive. Reactivate it before assigning animals.
                </p>
              )
            ) : (
              <p className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
                Owners and managers can record movements. Your role is{" "}
                <span className="font-semibold text-foreground">{context.membership.role}</span>.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 py-6">
            <CardTitle className="text-base">Edit land unit</CardTitle>
            <CardDescription>
              Update identity, acreage, and condition fields while keeping movement history intact.
            </CardDescription>
            {canManage ? (
              <EditLandUnitForm landUnit={landUnit} />
            ) : (
              <p className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
                Owners and managers can edit this unit.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Who is here now</h2>
          <p className="text-sm text-foreground-muted">
            Immediate occupancy snapshot for pasture, corral, pen, and stall workflows.
          </p>
        </div>
        {currentOccupants.length ? (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Animal</TableHeaderCell>
                  <TableHeaderCell>Species / class</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Assigned</TableHeaderCell>
                  <TableHeaderCell>Reason</TableHeaderCell>
                  <TableHeaderCell className="text-right">Actions</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {currentOccupants.map((occupant) => (
                  <TableRow key={occupant.animalId}>
                    <TableCell>
                      <Link
                        href={`/app/herd/${occupant.animalId}`}
                        className="font-semibold text-accent hover:underline"
                      >
                        {preferredAnimalLabel(occupant)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {formatAnimalSpecies(occupant.species)}
                      {occupant.animalClass ? ` - ${occupant.animalClass}` : ""}
                    </TableCell>
                    <TableCell>{occupant.status}</TableCell>
                    <TableCell>{formatDateTime(occupant.assignedAt)}</TableCell>
                    <TableCell>{formatMovementReason(occupant.movementReason)}</TableCell>
                    <TableCell className="text-right">
                      {canManage ? (
                        <RemoveAnimalFromUnitForm
                          landUnitId={landUnit.id}
                          animalId={occupant.animalId}
                        />
                      ) : (
                        <span className="text-xs text-foreground-muted">View only</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <EmptyState
            title="No current occupants"
            description="Use the movement action above to assign animals to this unit."
            icon={<MapPin className="h-5 w-5 text-accent" />}
          />
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Movement history</h2>
          <p className="text-sm text-foreground-muted">
            Historical assignment timeline for this specific unit.
          </p>
        </div>
        {movementHistory.length ? (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Animal</TableHeaderCell>
                  <TableHeaderCell>Moved in</TableHeaderCell>
                  <TableHeaderCell>Moved out</TableHeaderCell>
                  <TableHeaderCell>Reason</TableHeaderCell>
                  <TableHeaderCell>Recorded by</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {movementHistory.map((entry) => (
                  <TableRow key={entry.assignmentId}>
                    <TableCell>
                      <Link
                        href={`/app/herd/${entry.animalId}`}
                        className="font-semibold text-accent hover:underline"
                      >
                        {preferredAnimalLabel(entry)}
                      </Link>
                    </TableCell>
                    <TableCell>{formatDateTime(entry.assignedAt)}</TableCell>
                    <TableCell>{entry.endedAt ? formatDateTime(entry.endedAt) : "Current"}</TableCell>
                    <TableCell>{formatMovementReason(entry.movementReason)}</TableCell>
                    <TableCell>{entry.assignedByName ?? "System"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <EmptyState
            title="No movement history yet"
            description="Movement entries will appear here once occupancy changes are recorded."
            icon={<Clock3 className="h-5 w-5 text-accent" />}
          />
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Grazing period history</h2>
          <p className="text-sm text-foreground-muted">
            Recorded grazing/rest periods associated with this unit.
          </p>
        </div>
        {grazingHistory.length ? (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Period</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Linked herd context</TableHeaderCell>
                  <TableHeaderCell>Planned move</TableHeaderCell>
                  <TableHeaderCell>Notes</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {grazingHistory.map((period) => (
                  <TableRow key={period.periodId}>
                    <TableCell>
                      {formatDate(period.startedOn)}
                      {period.endedOn ? ` to ${formatDate(period.endedOn)}` : " to current"}
                    </TableCell>
                    <TableCell>{period.status}</TableCell>
                    <TableCell>
                      {period.animalGroupName ?? "No group linkage"} - {period.linkedAnimalCount} linked animals
                    </TableCell>
                    <TableCell>
                      {period.plannedMoveOn ? formatDate(period.plannedMoveOn) : "Not set"}
                    </TableCell>
                    <TableCell>{period.notes ?? "--"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <EmptyState
            title="No grazing periods yet"
            description="Open `/app/land/grazing` to record period and rest windows for this unit."
            icon={<Tractor className="h-5 w-5 text-accent" />}
          />
        )}
      </section>
    </div>
  );
}

