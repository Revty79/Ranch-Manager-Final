import Link from "next/link";
import { Wrench } from "lucide-react";
import { CreateEquipmentForm } from "@/components/equipment/create-equipment-form";
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
import { hasSectionAccess } from "@/lib/auth/capabilities";
import { requireSectionAccess } from "@/lib/auth/context";
import {
  equipmentStatusOptions,
  equipmentTypeOptions,
  formatEquipmentStatus,
  formatEquipmentType,
} from "@/lib/equipment/constants";
import {
  getEquipmentForRanch,
  getEquipmentSummary,
  resolveEquipmentFilters,
} from "@/lib/equipment/queries";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function statusVariant(status: "active" | "needs_maintenance" | "down" | "retired") {
  if (status === "active") return "success";
  if (status === "needs_maintenance") return "warning";
  if (status === "down") return "danger";
  return "neutral";
}

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; status?: string }>;
}) {
  const context = await requireSectionAccess("land");
  const canManage = hasSectionAccess(context.membership.sectionAccess, "land", "manage");
  const filters = resolveEquipmentFilters(await searchParams);

  const [summary, equipment] = await Promise.all([
    getEquipmentSummary(context.ranch.id),
    getEquipmentForRanch(context.ranch.id, filters),
  ]);

  const hasFilters =
    filters.search.length > 0 ||
    filters.equipmentType !== "all" ||
    filters.status !== "all";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Equipment"
        title="Equipment + Maintenance"
        description="Track trucks, tractors, trailers, pumps, tools, and ranch-ready maintenance needs."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total equipment" value={`${summary.totalEquipment}`} trend="All records" />
        <StatCard label="Active" value={`${summary.activeCount}`} trend="Ready now" />
        <StatCard
          label="Needs maintenance"
          value={`${summary.needsMaintenanceCount}`}
          trend="Attention needed"
        />
        <StatCard label="Down" value={`${summary.downCount}`} trend="Out of service" />
        <StatCard
          label="Overdue maintenance"
          value={`${summary.overdueMaintenanceCount}`}
          trend="Due date passed or marked overdue"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardContent className="space-y-4 py-6">
            <div>
              <CardTitle className="text-base">Filter equipment</CardTitle>
              <CardDescription>
                Search by name or identifier, then narrow by type and status.
              </CardDescription>
            </div>
            <form className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm md:col-span-2">
                <span className="text-foreground-muted">Search</span>
                <input
                  name="q"
                  defaultValue={filters.search}
                  placeholder="Truck, TRAILER-4, Pump..."
                  className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-foreground-muted">Type</span>
                <select
                  name="type"
                  defaultValue={filters.equipmentType}
                  className="h-10 w-full rounded-xl border bg-surface px-3 text-sm"
                >
                  <option value="all">All types</option>
                  {equipmentTypeOptions.map((option) => (
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
                  {equipmentStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
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
                  href="/app/equipment"
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
              <CardTitle className="text-base">Add equipment</CardTitle>
              <CardDescription>
                Owner and manager can create new equipment records and track maintenance.
              </CardDescription>
            </div>
            {canManage ? (
              <CreateEquipmentForm />
            ) : (
              <p className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
                You can view equipment and maintenance records, but only owners and managers
                can create or edit them.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Equipment records</h2>
          <p className="text-sm text-foreground-muted">
            Open each item to review history and maintenance details.
          </p>
        </div>
        {equipment.length ? (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell>Type</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Identifier</TableHeaderCell>
                  <TableHeaderCell>Next due</TableHeaderCell>
                  <TableHeaderCell>Open maintenance</TableHeaderCell>
                  <TableHeaderCell className="text-right">Actions</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {equipment.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-xs text-foreground-muted">
                          {item.currentLocation ?? "Location not set"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{formatEquipmentType(item.equipmentType)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(item.status)}>
                        {formatEquipmentStatus(item.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.identifier ?? "--"}</TableCell>
                    <TableCell>{item.nextDueOn ? formatDate(item.nextDueOn) : "--"}</TableCell>
                    <TableCell>
                      <div className="space-y-0.5 text-sm">
                        <p>{item.openMaintenanceCount} open</p>
                        <p className="text-xs text-foreground-muted">
                          {item.overdueMaintenanceCount} overdue
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/app/equipment/${item.id}`}
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
            title={hasFilters ? "No equipment matches these filters" : "No equipment yet"}
            description={
              hasFilters
                ? "Try broader filters or reset search."
                : "Add your first equipment record to start maintenance tracking."
            }
            icon={<Wrench className="h-5 w-5 text-accent" />}
          />
        )}
      </section>
    </div>
  );
}

