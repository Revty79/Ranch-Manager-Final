import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Camera, Clock3, HeartPulse, MapPin, Milestone, UsersRound } from "lucide-react";
import { BreedingRecordForm } from "@/components/herd/breeding-record-form";
import { EditAnimalForm } from "@/components/herd/edit-animal-form";
import { HealthRecordForm } from "@/components/herd/health-record-form";
import { PregnancyCheckForm } from "@/components/herd/pregnancy-check-form";
import { RecordAnimalEventForm } from "@/components/herd/record-animal-event-form";
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
import {
  formatAnimalEventType,
  formatAnimalSex,
  formatAnimalSpecies,
  formatAnimalStatus,
} from "@/lib/herd/constants";
import { getAnimalProfile, getAnimalReferenceOptions } from "@/lib/herd/queries";

function statusVariant(status: string) {
  if (status === "active") return "success";
  if (status === "deceased") return "danger";
  if (status === "sold" || status === "culled") return "warning";
  return "neutral";
}

function formatDate(value: string | null): string {
  if (!value) return "Not set";
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

function readEventDataString(
  eventData: Record<string, unknown>,
  key: string,
): string | null {
  const value = eventData[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export default async function AnimalDetailPage({
  params,
}: {
  params: Promise<{ animalId: string }>;
}) {
  const context = await requirePaidAccessContext();
  const { animalId } = await params;
  const canManage = roleCanManageOperations(context.membership.role);

  const profile = await getAnimalProfile(context.ranch.id, animalId);
  if (!profile) notFound();

  const referenceOptions = await getAnimalReferenceOptions(context.ranch.id, {
    excludeAnimalId: animalId,
  });

  const { animal, sire, dam, events } = profile;

  const lastBreeding = events.find((event) => event.eventType === "breeding") ?? null;
  const latestPregnancyCheck =
    events.find((event) => event.eventType === "pregnancy_check") ?? null;
  const expectedBirthDate =
    (latestPregnancyCheck
      ? readEventDataString(latestPregnancyCheck.eventData, "expectedBirthDate")
      : null) ??
    (lastBreeding ? readEventDataString(lastBreeding.eventData, "expectedBirthDate") : null);
  const latestPregnancyOutcome = latestPregnancyCheck
    ? readEventDataString(latestPregnancyCheck.eventData, "outcome") ?? "unknown"
    : "unknown";
  const offspringId = lastBreeding
    ? readEventDataString(lastBreeding.eventData, "offspringAnimalId")
    : null;
  const offspring = offspringId
    ? referenceOptions.find((option) => option.id === offspringId) ?? null
    : null;

  const recentHealthEvents = events
    .filter(
      (event) =>
        event.eventType === "vaccination" ||
        event.eventType === "treatment" ||
        event.eventType === "deworming" ||
        (event.eventType === "note" &&
          typeof event.eventData.healthRecordType === "string"),
    )
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Herd Detail"
        title={`${animal.tagId}${animal.displayName ? ` · ${animal.displayName}` : ""}`}
        description="Identity, lineage, location, lifecycle timeline, reproductive planning, and health history."
        actions={
          <Link
            href="/app/herd"
            className="rounded-xl border bg-surface px-3 py-2 text-sm font-semibold text-foreground-muted hover:bg-accent-soft hover:text-foreground"
          >
            Back to herd list
          </Link>
        }
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="space-y-3 py-6">
            <CardTitle className="text-base">Identity</CardTitle>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-foreground-muted">Internal ID:</span> {animal.internalId}
              </p>
              <p>
                <span className="text-foreground-muted">Alternate ID:</span>{" "}
                {animal.alternateId ?? "Not set"}
              </p>
              <p>
                <span className="text-foreground-muted">Species:</span>{" "}
                {formatAnimalSpecies(animal.species)}
              </p>
              <p>
                <span className="text-foreground-muted">Sex:</span> {formatAnimalSex(animal.sex)}
              </p>
              <p>
                <span className="text-foreground-muted">Class:</span>{" "}
                {animal.animalClass ?? "Not set"}
              </p>
              <p>
                <span className="text-foreground-muted">Breed:</span> {animal.breed ?? "Not set"}
              </p>
              <p>
                <span className="text-foreground-muted">Color/markings:</span>{" "}
                {animal.colorMarkings ?? "Not set"}
              </p>
              <p>
                <span className="text-foreground-muted">Calf + mom photo:</span>{" "}
                {animal.newbornPairPhotoDataUrl ? "On file" : "Not set"}
              </p>
            </div>
            <Badge variant={statusVariant(animal.status)}>{formatAnimalStatus(animal.status)}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 py-6">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-accent" />
              <CardTitle className="text-base">Current location</CardTitle>
            </div>
            <CardDescription>
              Location is pulled from active assignment records, not freeform text fields.
            </CardDescription>
            <p className="text-sm">
              {animal.currentLandUnitName ? (
                <>
                  <span className="font-semibold">{animal.currentLandUnitName}</span>
                  <span className="text-foreground-muted">
                    {" "}
                    · assigned {animal.currentAssignedAt ? formatDateTime(animal.currentAssignedAt) : "recently"}
                  </span>
                </>
              ) : (
                <span className="text-foreground-muted">No active land-unit assignment.</span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 py-6">
            <div className="flex items-center gap-2">
              <UsersRound className="h-4 w-4 text-accent" />
              <CardTitle className="text-base">Lineage links</CardTitle>
            </div>
            <CardDescription>Practical sire/dam references for internal herd context.</CardDescription>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-foreground-muted">Sire:</span>{" "}
                {sire ? (
                  <Link href={`/app/herd/${sire.id}`} className="font-semibold text-accent hover:underline">
                    {sire.label}
                  </Link>
                ) : (
                  "Not linked"
                )}
              </p>
              <p>
                <span className="text-foreground-muted">Dam:</span>{" "}
                {dam ? (
                  <Link href={`/app/herd/${dam.id}`} className="font-semibold text-accent hover:underline">
                    {dam.label}
                  </Link>
                ) : (
                  "Not linked"
                )}
              </p>
              <p>
                <span className="text-foreground-muted">Linked offspring:</span>{" "}
                {offspring ? (
                  <Link href={`/app/herd/${offspring.id}`} className="font-semibold text-accent hover:underline">
                    {offspring.label}
                  </Link>
                ) : (
                  "Not linked"
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 py-6">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-accent" />
              <CardTitle className="text-base">Calf + mom tracking photo</CardTitle>
            </div>
            {animal.newbornPairPhotoDataUrl ? (
              <div className="space-y-2">
                <Image
                  src={animal.newbornPairPhotoDataUrl}
                  alt={`${animal.tagId} calf and dam tracking photo`}
                  width={1024}
                  height={768}
                  unoptimized
                  className="h-52 w-full rounded-xl border object-cover"
                />
                <p className="text-xs text-foreground-muted">
                  Captured{" "}
                  {animal.newbornPairPhotoCapturedAt
                    ? formatDateTime(animal.newbornPairPhotoCapturedAt)
                    : "with record"}
                </p>
              </div>
            ) : (
              <p className="rounded-xl border bg-surface px-3 py-2 text-sm text-foreground-muted">
                No calf + mom tracking photo uploaded yet.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 py-6">
            <div className="flex items-center gap-2">
              <Milestone className="h-4 w-4 text-accent" />
              <CardTitle className="text-base">Lifecycle and reproductive summary</CardTitle>
            </div>
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <p>
                <span className="text-foreground-muted">Birth date:</span>{" "}
                {formatDate(animal.birthDate)}
                {animal.isBirthDateEstimated ? " (estimated)" : ""}
              </p>
              <p>
                <span className="text-foreground-muted">Acquired on:</span>{" "}
                {formatDate(animal.acquiredOn)}
              </p>
              <p>
                <span className="text-foreground-muted">Last breeding/service:</span>{" "}
                {lastBreeding ? formatDateTime(lastBreeding.occurredAt) : "Not recorded"}
              </p>
              <p>
                <span className="text-foreground-muted">Latest pregnancy status:</span>{" "}
                {latestPregnancyOutcome}
              </p>
              <p>
                <span className="text-foreground-muted">Expected birth planning:</span>{" "}
                {expectedBirthDate ? formatDate(expectedBirthDate) : "Not set"}
              </p>
              <p>
                <span className="text-foreground-muted">Disposition date:</span>{" "}
                {formatDate(animal.dispositionOn)}
              </p>
            </div>
            <div className="rounded-xl border bg-surface p-3 text-sm text-foreground-muted">
              Notes: {animal.notes ?? "No notes recorded."}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 py-6">
            <div className="flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-accent" />
              <CardTitle className="text-base">Recent health records</CardTitle>
            </div>
            {recentHealthEvents.length ? (
              <ul className="space-y-2 text-sm text-foreground-muted">
                {recentHealthEvents.map((event) => (
                  <li key={event.id} className="rounded-lg border bg-surface px-3 py-2">
                    <p className="font-semibold text-foreground">{event.summary}</p>
                    <p>
                      {formatAnimalEventType(event.eventType)} · {formatDateTime(event.occurredAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-foreground-muted">
                No structured health records yet.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardContent className="space-y-4 py-6">
            <CardTitle className="text-base">Lifecycle events</CardTitle>
            <CardDescription>
              Birth, acquisition, disposition, cull, and note records.
            </CardDescription>
            {canManage ? (
              <RecordAnimalEventForm animalId={animal.id} />
            ) : (
              <p className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
                Owners and managers can record lifecycle events.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 py-6">
            <CardTitle className="text-base">Breeding records</CardTitle>
            <CardDescription>
              Record service details, pregnancy checks, planning windows, and offspring linkage.
            </CardDescription>
            {canManage ? (
              <div className="space-y-5">
                <BreedingRecordForm animalId={animal.id} animalOptions={referenceOptions} />
                <div className="h-px bg-border" />
                <PregnancyCheckForm animalId={animal.id} />
              </div>
            ) : (
              <p className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
                Owners and managers can record breeding/pregnancy workflows.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 py-6">
            <CardTitle className="text-base">Health records</CardTitle>
            <CardDescription>
              Vaccination, treatment, deworming, and related health documentation.
            </CardDescription>
            {canManage ? (
              <HealthRecordForm animalId={animal.id} />
            ) : (
              <p className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
                Owners and managers can record health workflows.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardContent className="space-y-4 py-6">
          <CardTitle className="text-base">Edit animal record</CardTitle>
          <CardDescription>
            Keep identity and lifecycle data accurate. Status updates are captured in timeline history.
          </CardDescription>
          {canManage ? (
            <EditAnimalForm animal={animal} parentOptions={referenceOptions} />
          ) : (
            <p className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
              Owners and managers can edit animal records. You can still review history.
            </p>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Event timeline</h2>
          <p className="text-sm text-foreground-muted">
            Structured lifecycle, breeding, and health history for this animal.
          </p>
        </div>
        {events.length ? (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Occurred</TableHeaderCell>
                  <TableHeaderCell>Type</TableHeaderCell>
                  <TableHeaderCell>Summary</TableHeaderCell>
                  <TableHeaderCell>Details</TableHeaderCell>
                  <TableHeaderCell>Recorded by</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>{formatDateTime(event.occurredAt)}</TableCell>
                    <TableCell>{formatAnimalEventType(event.eventType)}</TableCell>
                    <TableCell>{event.summary}</TableCell>
                    <TableCell>{event.details ?? "—"}</TableCell>
                    <TableCell>{event.recordedByName ?? "System"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <EmptyState
            title="No events yet"
            description="Record the first lifecycle, breeding, or health event to build timeline history."
            icon={<Clock3 className="h-5 w-5 text-accent" />}
          />
        )}
      </section>
    </div>
  );
}
