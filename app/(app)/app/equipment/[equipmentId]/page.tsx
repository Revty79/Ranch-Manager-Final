import Link from "next/link";
import { notFound } from "next/navigation";
import { Wrench } from "lucide-react";
import { CreateMaintenanceRecordForm } from "@/components/equipment/create-maintenance-record-form";
import { EditEquipmentForm } from "@/components/equipment/edit-equipment-form";
import { EditMaintenanceRecordForm } from "@/components/equipment/edit-maintenance-record-form";
import { EmptyState } from "@/components/patterns/empty-state";
import { PageHeader } from "@/components/patterns/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { hasSectionAccess } from "@/lib/auth/capabilities";
import { requireSectionAccess } from "@/lib/auth/context";
import {
  formatEquipmentStatus,
  formatEquipmentType,
  formatMaintenancePriority,
  formatMaintenanceStatus,
  formatMaintenanceType,
} from "@/lib/equipment/constants";
import {
  getEquipmentById,
  getLinkableWorkOrderOptions,
} from "@/lib/equipment/queries";
import { getAssignableMembersForRanch } from "@/lib/work-orders/queries";

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

function formatMoney(cents: number | null): string {
  if (cents == null) return "--";
  return `$${(cents / 100).toFixed(2)}`;
}

function equipmentStatusVariant(status: "active" | "needs_maintenance" | "down" | "retired") {
  if (status === "active") return "success";
  if (status === "needs_maintenance") return "warning";
  if (status === "down") return "danger";
  return "neutral";
}

function maintenanceStatusVariant(
  status: "scheduled" | "due" | "overdue" | "in_progress" | "completed" | "cancelled",
) {
  if (status === "completed") return "success";
  if (status === "cancelled") return "neutral";
  if (status === "overdue") return "danger";
  if (status === "due") return "warning";
  return "neutral";
}

export default async function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ equipmentId: string }>;
}) {
  const context = await requireSectionAccess("land");
  const { equipmentId } = await params;
  const canManage = hasSectionAccess(context.membership.sectionAccess, "land", "manage");

  const [equipmentDetail, members, workOrderOptions] = await Promise.all([
    getEquipmentById(context.ranch.id, equipmentId),
    getAssignableMembersForRanch(context.ranch.id),
    getLinkableWorkOrderOptions(context.ranch.id),
  ]);

  if (!equipmentDetail) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Equipment Detail"
        title={equipmentDetail.equipment.name}
        description="Equipment identity, status, and maintenance tracking."
        actions={
          <Link
            href="/app/equipment"
            className="rounded-xl border bg-surface px-3 py-2 text-sm font-semibold text-foreground-muted hover:bg-accent-soft hover:text-foreground"
          >
            Back to equipment
          </Link>
        }
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="space-y-3 py-6">
            <CardTitle className="text-base">Identity</CardTitle>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-foreground-muted">Type:</span>{" "}
                {formatEquipmentType(equipmentDetail.equipment.equipmentType)}
              </p>
              <p>
                <span className="text-foreground-muted">Identifier:</span>{" "}
                {equipmentDetail.equipment.identifier ?? "Not set"}
              </p>
              <p>
                <span className="text-foreground-muted">Make/model:</span>{" "}
                {equipmentDetail.equipment.make || equipmentDetail.equipment.model
                  ? `${equipmentDetail.equipment.make ?? ""} ${equipmentDetail.equipment.model ?? ""}`.trim()
                  : "Not set"}
              </p>
              <p>
                <span className="text-foreground-muted">Year:</span>{" "}
                {equipmentDetail.equipment.year ?? "Not set"}
              </p>
              <p>
                <span className="text-foreground-muted">Serial:</span>{" "}
                {equipmentDetail.equipment.serialNumber ?? "Not set"}
              </p>
              <p>
                <span className="text-foreground-muted">Plate/VIN:</span>{" "}
                {equipmentDetail.equipment.plateVin ?? "Not set"}
              </p>
              <p>
                <span className="text-foreground-muted">Current location:</span>{" "}
                {equipmentDetail.equipment.currentLocation ?? "Not set"}
              </p>
              <p>
                <span className="text-foreground-muted">Created:</span>{" "}
                {formatDateTime(equipmentDetail.equipment.createdAt)}
              </p>
              <p>
                <span className="text-foreground-muted">Updated:</span>{" "}
                {formatDateTime(equipmentDetail.equipment.updatedAt)}
              </p>
            </div>
            <Badge variant={equipmentStatusVariant(equipmentDetail.equipment.status)}>
              {formatEquipmentStatus(equipmentDetail.equipment.status)}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 py-6">
            <CardTitle className="text-base">Maintenance summary</CardTitle>
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-foreground-muted">Total records:</span>{" "}
                <span className="font-semibold">{equipmentDetail.maintenanceSummary.total}</span>
              </p>
              <p>
                <span className="text-foreground-muted">Open:</span>{" "}
                <span className="font-semibold">{equipmentDetail.maintenanceSummary.open}</span>
              </p>
              <p>
                <span className="text-foreground-muted">Overdue:</span>{" "}
                <span className="font-semibold">
                  {equipmentDetail.maintenanceSummary.overdue}
                </span>
              </p>
              <p>
                <span className="text-foreground-muted">Completed:</span>{" "}
                <span className="font-semibold">
                  {equipmentDetail.maintenanceSummary.completed}
                </span>
              </p>
              <p>
                <span className="text-foreground-muted">Cancelled:</span>{" "}
                <span className="font-semibold">
                  {equipmentDetail.maintenanceSummary.cancelled}
                </span>
              </p>
              <p>
                <span className="text-foreground-muted">Next due:</span>{" "}
                <span className="font-semibold">
                  {formatDate(equipmentDetail.maintenanceSummary.nextDueOn)}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 py-6 text-sm">
            <CardTitle className="text-base">Notes</CardTitle>
            <CardDescription>
              Equipment records stay in history. Use status `retired` instead of deleting records.
            </CardDescription>
            <p className="rounded-xl border bg-surface px-3 py-2 text-foreground-muted">
              {equipmentDetail.equipment.notes ?? "No notes yet."}
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardContent className="space-y-4 py-6">
            <div>
              <CardTitle className="text-base">Edit equipment</CardTitle>
              <CardDescription>
                Update identity, status, and field details while preserving maintenance history.
              </CardDescription>
            </div>
            {canManage ? (
              <EditEquipmentForm equipment={equipmentDetail.equipment} />
            ) : (
              <p className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
                You can view this equipment record, but only owners and managers can edit it.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 py-6">
            <div>
              <CardTitle className="text-base">Add maintenance</CardTitle>
              <CardDescription>
                Track scheduled, due, overdue, and completed maintenance. Optionally link or create
                a related work order.
              </CardDescription>
            </div>
            {canManage ? (
              <CreateMaintenanceRecordForm
                equipmentId={equipmentDetail.equipment.id}
                members={members}
                workOrderOptions={workOrderOptions}
              />
            ) : (
              <p className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
                You can view maintenance history, but only owners and managers can create or update
                maintenance records.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Open and scheduled maintenance</h2>
          <p className="text-sm text-foreground-muted">
            Move items through scheduled, due, overdue, in progress, and completed states.
          </p>
        </div>
        {equipmentDetail.openMaintenance.length ? (
          <div className="space-y-3">
            {equipmentDetail.openMaintenance.map((maintenance) => (
              <Card key={maintenance.id}>
                <CardContent className="space-y-3 py-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={maintenanceStatusVariant(maintenance.status)}>
                      {formatMaintenanceStatus(maintenance.status)}
                    </Badge>
                    <Badge variant="neutral">
                      {formatMaintenancePriority(maintenance.priority)}
                    </Badge>
                    <Badge variant="neutral">
                      {formatMaintenanceType(maintenance.maintenanceType)}
                    </Badge>
                  </div>
                  <div className="grid gap-2 text-sm md:grid-cols-2">
                    <p>
                      <span className="text-foreground-muted">Title:</span> {maintenance.title}
                    </p>
                    <p>
                      <span className="text-foreground-muted">Due:</span>{" "}
                      {formatDate(maintenance.dueOn)}
                    </p>
                    <p>
                      <span className="text-foreground-muted">Assigned:</span>{" "}
                      {maintenance.assignedToName ?? "Unassigned"}
                    </p>
                    <p>
                      <span className="text-foreground-muted">Cost:</span>{" "}
                      {formatMoney(maintenance.costCents)}
                    </p>
                    <p className="md:col-span-2">
                      <span className="text-foreground-muted">Work order:</span>{" "}
                      {maintenance.relatedWorkOrderId ? (
                        <Link
                          href={`/app/work-orders/${maintenance.relatedWorkOrderId}`}
                          className="font-semibold text-accent hover:underline"
                        >
                          {maintenance.relatedWorkOrderTitle ?? "Linked work order"}
                        </Link>
                      ) : (
                        "None linked"
                      )}
                    </p>
                    <p className="md:col-span-2">
                      <span className="text-foreground-muted">Notes:</span>{" "}
                      {maintenance.notes ?? "No notes"}
                    </p>
                  </div>
                  {canManage ? (
                    <EditMaintenanceRecordForm
                      equipmentId={equipmentDetail.equipment.id}
                      maintenance={maintenance}
                      members={members}
                      workOrderOptions={workOrderOptions}
                    />
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No open maintenance"
            description="Scheduled and in-progress maintenance will appear here."
            icon={<Wrench className="h-5 w-5 text-accent" />}
          />
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 py-6">
            <div>
              <CardTitle className="text-base">Completed maintenance history</CardTitle>
              <CardDescription>
                Completed items are retained for audit and service history.
              </CardDescription>
            </div>
            {equipmentDetail.completedMaintenance.length ? (
              <div className="space-y-2">
                {equipmentDetail.completedMaintenance.map((maintenance) => (
                  <div key={maintenance.id} className="rounded-xl border bg-surface px-3 py-2 text-sm">
                    <p className="font-semibold">{maintenance.title}</p>
                    <p className="text-foreground-muted">
                      {formatMaintenanceType(maintenance.maintenanceType)} • Completed{" "}
                      {formatDate(maintenance.completedOn)}
                    </p>
                    {maintenance.relatedWorkOrderId ? (
                      <p className="text-foreground-muted">
                        Work order:{" "}
                        <Link
                          href={`/app/work-orders/${maintenance.relatedWorkOrderId}`}
                          className="font-semibold text-accent hover:underline"
                        >
                          {maintenance.relatedWorkOrderTitle ?? "Linked work order"}
                        </Link>
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
                No completed maintenance yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 py-6">
            <div>
              <CardTitle className="text-base">Cancelled maintenance</CardTitle>
              <CardDescription>
                Cancelled records are retained to preserve operational history.
              </CardDescription>
            </div>
            {equipmentDetail.cancelledMaintenance.length ? (
              <div className="space-y-2">
                {equipmentDetail.cancelledMaintenance.map((maintenance) => (
                  <div key={maintenance.id} className="rounded-xl border bg-surface px-3 py-2 text-sm">
                    <p className="font-semibold">{maintenance.title}</p>
                    <p className="text-foreground-muted">
                      {formatMaintenanceType(maintenance.maintenanceType)} • Cancelled
                    </p>
                    {maintenance.notes ? (
                      <p className="text-foreground-muted">Notes: {maintenance.notes}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
                No cancelled maintenance records.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

