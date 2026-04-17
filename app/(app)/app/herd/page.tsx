import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { CreateAnimalForm } from "@/components/herd/create-animal-form";
import { CreateAnimalGroupForm } from "@/components/herd/create-animal-group-form";
import { ManageAnimalGroupMembersForm } from "@/components/herd/manage-animal-group-members-form";
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
import {
  animalSexOptions,
  animalSpeciesOptions,
  animalStatusOptions,
  formatAnimalSex,
  formatAnimalSpecies,
  formatAnimalStatus,
} from "@/lib/herd/constants";
import {
  getAnimalClassOptions,
  getAnimalReferenceOptions,
  getAnimalRegistryRows,
  getHerdRegistrySummary,
  resolveAnimalRegistryFilters,
} from "@/lib/herd/queries";
import { getAnimalGroupWorkspace } from "@/lib/herd/group-queries";
import { getProtocolDueItemsForRanch } from "@/lib/herd/protocol-queries";

function statusVariant(status: string) {
  if (status === "active") return "success";
  if (status === "deceased") return "danger";
  if (status === "sold" || status === "culled") return "warning";
  return "neutral";
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function dueVariant(dueState: string) {
  if (dueState === "overdue") return "danger";
  if (dueState === "due_soon") return "warning";
  return "neutral";
}

function dueLabel(daysUntil: number): string {
  if (daysUntil < 0) return `${Math.abs(daysUntil)}d overdue`;
  if (daysUntil === 0) return "due today";
  return `due in ${daysUntil}d`;
}

export default async function HerdPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    species?: string;
    status?: string;
    sex?: string;
    animalClass?: string;
  }>;
}) {
  const context = await requirePaidAccessContext();
  const params = await searchParams;
  const filters = resolveAnimalRegistryFilters(params);
  const canManage = roleCanManageOperations(context.membership.role);

  const [animals, classOptions, parentOptions, summary, dueItems, groupWorkspace] = await Promise.all([
    getAnimalRegistryRows(context.ranch.id, filters),
    getAnimalClassOptions(context.ranch.id),
    canManage ? getAnimalReferenceOptions(context.ranch.id) : Promise.resolve([]),
    getHerdRegistrySummary(context.ranch.id),
    getProtocolDueItemsForRanch(context.ranch.id, { limit: 6 }),
    getAnimalGroupWorkspace(context.ranch.id),
  ]);

  const hasFilters =
    filters.search.length > 0 ||
    filters.species !== "all" ||
    filters.status !== "all" ||
    filters.sex !== "all" ||
    filters.animalClass.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Herd"
        title="Animal Registry"
        description="Track cattle, horses, and other livestock species in one operational registry with structured lifecycle history and current location visibility."
        actions={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href="/app/herd/export?type=inventory"
                className="rounded-xl border bg-surface px-3 py-2 text-sm font-semibold text-foreground-muted hover:bg-accent-soft hover:text-foreground"
              >
                Export inventory CSV
              </Link>
              <Link
                href="/app/herd/export?type=due"
                className="rounded-xl border bg-surface px-3 py-2 text-sm font-semibold text-foreground-muted hover:bg-accent-soft hover:text-foreground"
              >
                Export due-list CSV
              </Link>
            </div>
          ) : null
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total" value={`${summary.totalAnimals}`} trend="All registry records" />
        <StatCard label="Active" value={`${summary.activeAnimals}`} trend="Ready for operations" />
        <StatCard label="Sold" value={`${summary.soldAnimals}`} trend="Disposition recorded" />
        <StatCard label="Deceased" value={`${summary.deceasedAnimals}`} trend="Loss history retained" />
        <StatCard label="Archived" value={`${summary.archivedAnimals}`} trend="Hidden from active workflows" />
      </section>

      <Card>
        <CardContent className="space-y-3 py-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Protocol due snapshot</CardTitle>
              <CardDescription>
                Ranch-configurable reminders. Final protocol decisions should align with veterinary guidance.
              </CardDescription>
            </div>
            <Link href="/app/herd/breeding" className="text-sm font-semibold text-accent hover:underline">
              Open full due list
            </Link>
          </div>
          {dueItems.length ? (
            <ul className="grid gap-2 md:grid-cols-2">
              {dueItems.map((item) => (
                <li key={`${item.protocolId}-${item.animalId}`} className="rounded-xl border bg-surface px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/app/herd/${item.animalId}`} className="font-semibold text-accent hover:underline">
                      {item.animalDisplayName
                        ? `${item.animalDisplayName} (${item.animalTagId})`
                        : item.animalTagId}
                    </Link>
                    <Badge variant={dueVariant(item.dueState)}>{dueLabel(item.daysUntilDue)}</Badge>
                  </div>
                  <p className="text-foreground-muted">{item.protocolName}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-foreground-muted">
              No due reminders yet. Configure templates in `/app/herd/breeding`.
            </p>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardContent className="space-y-4 py-6">
            <div>
              <CardTitle className="text-base">Filter registry</CardTitle>
              <CardDescription>Search by tag, ID, name, or breed with practical lifecycle filters.</CardDescription>
            </div>
            <form className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-foreground-muted">Search</span>
                <input
                  name="q"
                  defaultValue={filters.search}
                  placeholder="Tag, ID, name, breed..."
                  className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-foreground-muted">Species</span>
                <select
                  name="species"
                  defaultValue={filters.species}
                  className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
                >
                  <option value="all">All species</option>
                  {animalSpeciesOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-foreground-muted">Status</span>
                <select
                  name="status"
                  defaultValue={filters.status}
                  className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
                >
                  <option value="all">All statuses</option>
                  {animalStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-foreground-muted">Sex</span>
                <select
                  name="sex"
                  defaultValue={filters.sex}
                  className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
                >
                  <option value="all">All sex values</option>
                  {animalSexOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm md:col-span-2">
                <span className="text-foreground-muted">Class / category</span>
                <select
                  name="animalClass"
                  defaultValue={filters.animalClass}
                  className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
                >
                  <option value="">All classes</option>
                  {classOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
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
                  href="/app/herd"
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
              <CardTitle className="text-base">Add animal</CardTitle>
              <CardDescription>
                Capture practical ranch records across cattle, horses, and additional livestock species.
              </CardDescription>
            </div>
            {canManage ? (
              <CreateAnimalForm parentOptions={parentOptions} />
            ) : (
              <p className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
                Owners and managers can add animals. Your role is{" "}
                <span className="font-semibold text-foreground">{context.membership.role}</span>.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Herd groups</h2>
          <p className="text-sm text-foreground-muted">
            Build operational herds, assign members, and use those groups in grazing-rotation planning.
          </p>
        </div>

        <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <Card>
            <CardContent className="space-y-4 py-6">
              <div>
                <CardTitle className="text-base">Create herd group</CardTitle>
                <CardDescription>
                  Define practical groups such as cow-calf pairs, replacement heifers, or custom management cohorts.
                </CardDescription>
              </div>
              {canManage ? (
                <CreateAnimalGroupForm />
              ) : (
                <p className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
                  Owners and managers can create herd groups.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 py-6">
              <div>
                <CardTitle className="text-base">Manage group members</CardTitle>
                <CardDescription>
                  Membership here is the source-of-truth for herd-group rotations in land grazing workflows.
                </CardDescription>
              </div>
              {groupWorkspace.groups.length ? (
                canManage ? (
                  <div className="space-y-3">
                    {groupWorkspace.groups.map((group) => (
                      <ManageAnimalGroupMembersForm
                        key={group.id}
                        group={group}
                        animalOptions={groupWorkspace.animalOptions}
                        reassignmentOptions={groupWorkspace.groups
                          .filter((option) => option.id !== group.id && option.isActive)
                          .map((option) => ({ id: option.id, name: option.name }))}
                      />
                    ))}
                  </div>
                ) : (
                  <ul className="space-y-2 text-sm text-foreground-muted">
                    {groupWorkspace.groups.map((group) => (
                      <li key={group.id} className="rounded-xl border bg-surface px-3 py-2">
                        <p className="font-semibold text-foreground">{group.name}</p>
                        <p>
                          {group.groupType.replace("_", " ")} - {group.memberCount} active members
                        </p>
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                <EmptyState
                  title="No herd groups yet"
                  description="Create your first group, then assign members for rotation planning."
                  icon={<ClipboardList className="h-5 w-5 text-accent" />}
                />
              )}
            </CardContent>
          </Card>
        </section>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Registry list</h2>
          <p className="text-sm text-foreground-muted">
            Tag/ID identity, lifecycle status, and current location in one view.
          </p>
        </div>
        {animals.length ? (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Tag / ID</TableHeaderCell>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell>Species / class</TableHeaderCell>
                  <TableHeaderCell>Sex</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Current location</TableHeaderCell>
                  <TableHeaderCell>Updated</TableHeaderCell>
                  <TableHeaderCell className="text-right">Actions</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {animals.map((animal) => (
                  <TableRow key={animal.id}>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="font-semibold">{animal.tagId}</p>
                        <p className="text-xs text-foreground-muted">{animal.internalId}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p>{animal.displayName ?? "Unnamed"}</p>
                        <p className="text-xs text-foreground-muted">
                          {animal.alternateId ?? "No alternate ID"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p>{formatAnimalSpecies(animal.species)}</p>
                        <p className="text-xs text-foreground-muted">
                          {animal.animalClass ?? "No class set"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{formatAnimalSex(animal.sex)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(animal.status)}>{formatAnimalStatus(animal.status)}</Badge>
                    </TableCell>
                    <TableCell>{animal.currentLandUnitName ?? "Unassigned"}</TableCell>
                    <TableCell>{formatDate(animal.updatedAt)}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/app/herd/${animal.id}`}
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
            title={hasFilters ? "No animals match these filters" : "No animals registered yet"}
            description={
              hasFilters
                ? "Try broader filters or clear search fields."
                : "Add the first animal above to start lifecycle tracking."
            }
            icon={<ClipboardList className="h-5 w-5 text-accent" />}
          />
        )}
      </section>
    </div>
  );
}
