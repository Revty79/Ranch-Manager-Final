import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  equipmentMaintenanceRecords,
  equipmentRecords,
  ranchMemberships,
  users,
  workOrders,
  type EquipmentStatus,
  type EquipmentType,
  type MaintenancePriority,
  type MaintenanceStatus,
  type MaintenanceType,
  type WorkOrderStatus,
} from "@/lib/db/schema";
import { equipmentStatusOptions, equipmentTypeOptions } from "./constants";

const equipmentTypeSet = new Set<EquipmentType>(
  equipmentTypeOptions.map((option) => option.value),
);
const equipmentStatusSet = new Set<EquipmentStatus>(
  equipmentStatusOptions.map((option) => option.value),
);

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function isOpenMaintenanceStatus(status: MaintenanceStatus): boolean {
  return status !== "completed" && status !== "cancelled";
}

function isOverdueMaintenance(row: {
  status: MaintenanceStatus;
  dueOn: string | null;
}): boolean {
  if (row.status === "overdue") {
    return true;
  }
  return (
    isOpenMaintenanceStatus(row.status) &&
    row.dueOn != null &&
    row.dueOn < todayDateKey()
  );
}

export interface EquipmentFilters {
  search: string;
  equipmentType: EquipmentType | "all";
  status: EquipmentStatus | "all";
}

export function resolveEquipmentFilters(params: {
  q?: string;
  type?: string;
  status?: string;
}): EquipmentFilters {
  const equipmentType =
    params.type && equipmentTypeSet.has(params.type as EquipmentType)
      ? (params.type as EquipmentType)
      : "all";
  const status =
    params.status && equipmentStatusSet.has(params.status as EquipmentStatus)
      ? (params.status as EquipmentStatus)
      : "all";

  return {
    search: params.q?.trim() ?? "",
    equipmentType,
    status,
  };
}

export interface EquipmentSummary {
  totalEquipment: number;
  activeCount: number;
  needsMaintenanceCount: number;
  downCount: number;
  overdueMaintenanceCount: number;
}

export interface EquipmentListItem {
  id: string;
  name: string;
  equipmentType: EquipmentType;
  status: EquipmentStatus;
  identifier: string | null;
  currentLocation: string | null;
  openMaintenanceCount: number;
  overdueMaintenanceCount: number;
  nextDueOn: string | null;
  updatedAt: Date;
}

export interface EquipmentMaintenanceRow {
  id: string;
  title: string;
  maintenanceType: MaintenanceType;
  status: MaintenanceStatus;
  priority: MaintenancePriority;
  dueOn: string | null;
  completedOn: string | null;
  assignedMembershipId: string | null;
  assignedToName: string | null;
  relatedWorkOrderId: string | null;
  relatedWorkOrderTitle: string | null;
  relatedWorkOrderStatus: WorkOrderStatus | null;
  costCents: number | null;
  notes: string | null;
  createdByMembershipId: string | null;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EquipmentMaintenanceSummary {
  total: number;
  open: number;
  completed: number;
  cancelled: number;
  overdue: number;
  nextDueOn: string | null;
}

export interface EquipmentDetail {
  equipment: {
    id: string;
    name: string;
    equipmentType: EquipmentType;
    status: EquipmentStatus;
    identifier: string | null;
    make: string | null;
    model: string | null;
    year: number | null;
    serialNumber: string | null;
    plateVin: string | null;
    currentLocation: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  maintenanceSummary: EquipmentMaintenanceSummary;
  openMaintenance: EquipmentMaintenanceRow[];
  completedMaintenance: EquipmentMaintenanceRow[];
  cancelledMaintenance: EquipmentMaintenanceRow[];
}

export interface LinkableWorkOrderOption {
  id: string;
  title: string;
  status: WorkOrderStatus;
  dueAt: Date | null;
}

export async function getEquipmentSummary(ranchId: string): Promise<EquipmentSummary> {
  const [equipmentCountRows, overdueRows] = await Promise.all([
    db
      .select({
        totalEquipment: sql<number>`count(*)::int`,
        activeCount: sql<number>`count(case when ${equipmentRecords.status} = 'active' then 1 end)::int`,
        needsMaintenanceCount: sql<number>`count(case when ${equipmentRecords.status} = 'needs_maintenance' then 1 end)::int`,
        downCount: sql<number>`count(case when ${equipmentRecords.status} = 'down' then 1 end)::int`,
      })
      .from(equipmentRecords)
      .where(eq(equipmentRecords.ranchId, ranchId)),
    db
      .select({
        overdueMaintenanceCount: sql<number>`count(case when (${equipmentMaintenanceRecords.status} = 'overdue' or (${equipmentMaintenanceRecords.status} not in ('completed', 'cancelled') and ${equipmentMaintenanceRecords.dueOn} is not null and ${equipmentMaintenanceRecords.dueOn} < current_date)) then 1 end)::int`,
      })
      .from(equipmentMaintenanceRecords)
      .where(eq(equipmentMaintenanceRecords.ranchId, ranchId)),
  ]);

  return {
    totalEquipment: equipmentCountRows[0]?.totalEquipment ?? 0,
    activeCount: equipmentCountRows[0]?.activeCount ?? 0,
    needsMaintenanceCount: equipmentCountRows[0]?.needsMaintenanceCount ?? 0,
    downCount: equipmentCountRows[0]?.downCount ?? 0,
    overdueMaintenanceCount: overdueRows[0]?.overdueMaintenanceCount ?? 0,
  };
}

export async function getEquipmentForRanch(
  ranchId: string,
  filters: EquipmentFilters,
): Promise<EquipmentListItem[]> {
  const conditions = [eq(equipmentRecords.ranchId, ranchId)];

  if (filters.search) {
    const pattern = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(equipmentRecords.name, pattern),
        ilike(equipmentRecords.identifier, pattern),
      )!,
    );
  }

  if (filters.equipmentType !== "all") {
    conditions.push(eq(equipmentRecords.equipmentType, filters.equipmentType));
  }

  if (filters.status !== "all") {
    conditions.push(eq(equipmentRecords.status, filters.status));
  }

  const rows = await db
    .select({
      id: equipmentRecords.id,
      name: equipmentRecords.name,
      equipmentType: equipmentRecords.equipmentType,
      status: equipmentRecords.status,
      identifier: equipmentRecords.identifier,
      currentLocation: equipmentRecords.currentLocation,
      openMaintenanceCount: sql<number>`count(case when ${equipmentMaintenanceRecords.status} not in ('completed', 'cancelled') then 1 end)::int`,
      overdueMaintenanceCount: sql<number>`count(case when (${equipmentMaintenanceRecords.status} = 'overdue' or (${equipmentMaintenanceRecords.status} not in ('completed', 'cancelled') and ${equipmentMaintenanceRecords.dueOn} is not null and ${equipmentMaintenanceRecords.dueOn} < current_date)) then 1 end)::int`,
      nextDueOn: sql<string | null>`min(case when ${equipmentMaintenanceRecords.status} not in ('completed', 'cancelled') then ${equipmentMaintenanceRecords.dueOn} end)`,
      updatedAt: equipmentRecords.updatedAt,
    })
    .from(equipmentRecords)
    .leftJoin(
      equipmentMaintenanceRecords,
      and(
        eq(equipmentMaintenanceRecords.ranchId, ranchId),
        eq(equipmentMaintenanceRecords.equipmentId, equipmentRecords.id),
      ),
    )
    .where(and(...conditions))
    .groupBy(
      equipmentRecords.id,
      equipmentRecords.name,
      equipmentRecords.equipmentType,
      equipmentRecords.status,
      equipmentRecords.identifier,
      equipmentRecords.currentLocation,
      equipmentRecords.updatedAt,
    )
    .orderBy(asc(equipmentRecords.name), asc(equipmentRecords.createdAt));

  return rows;
}

export async function getEquipmentById(
  ranchId: string,
  equipmentId: string,
): Promise<EquipmentDetail | null> {
  const [equipment] = await db
    .select({
      id: equipmentRecords.id,
      name: equipmentRecords.name,
      equipmentType: equipmentRecords.equipmentType,
      status: equipmentRecords.status,
      identifier: equipmentRecords.identifier,
      make: equipmentRecords.make,
      model: equipmentRecords.model,
      year: equipmentRecords.year,
      serialNumber: equipmentRecords.serialNumber,
      plateVin: equipmentRecords.plateVin,
      currentLocation: equipmentRecords.currentLocation,
      notes: equipmentRecords.notes,
      createdAt: equipmentRecords.createdAt,
      updatedAt: equipmentRecords.updatedAt,
    })
    .from(equipmentRecords)
    .where(and(eq(equipmentRecords.ranchId, ranchId), eq(equipmentRecords.id, equipmentId)))
    .limit(1);

  if (!equipment) {
    return null;
  }

  const maintenanceRows = await db
    .select({
      id: equipmentMaintenanceRecords.id,
      title: equipmentMaintenanceRecords.title,
      maintenanceType: equipmentMaintenanceRecords.maintenanceType,
      status: equipmentMaintenanceRecords.status,
      priority: equipmentMaintenanceRecords.priority,
      dueOn: equipmentMaintenanceRecords.dueOn,
      completedOn: equipmentMaintenanceRecords.completedOn,
      assignedMembershipId: equipmentMaintenanceRecords.assignedMembershipId,
      assignedToName: users.fullName,
      relatedWorkOrderId: equipmentMaintenanceRecords.relatedWorkOrderId,
      relatedWorkOrderTitle: workOrders.title,
      relatedWorkOrderStatus: workOrders.status,
      costCents: equipmentMaintenanceRecords.costCents,
      notes: equipmentMaintenanceRecords.notes,
      createdByMembershipId: equipmentMaintenanceRecords.createdByMembershipId,
      createdAt: equipmentMaintenanceRecords.createdAt,
      updatedAt: equipmentMaintenanceRecords.updatedAt,
    })
    .from(equipmentMaintenanceRecords)
    .leftJoin(
      ranchMemberships,
      eq(equipmentMaintenanceRecords.assignedMembershipId, ranchMemberships.id),
    )
    .leftJoin(users, eq(ranchMemberships.userId, users.id))
    .leftJoin(workOrders, eq(equipmentMaintenanceRecords.relatedWorkOrderId, workOrders.id))
    .where(
      and(
        eq(equipmentMaintenanceRecords.ranchId, ranchId),
        eq(equipmentMaintenanceRecords.equipmentId, equipmentId),
      ),
    )
    .orderBy(desc(equipmentMaintenanceRecords.createdAt));

  const creatorMembershipIds = [
    ...new Set(
      maintenanceRows
        .map((row) => row.createdByMembershipId)
        .filter((membershipId): membershipId is string => Boolean(membershipId)),
    ),
  ];
  const creatorRows =
    creatorMembershipIds.length > 0
      ? await db
          .select({
            membershipId: ranchMemberships.id,
            fullName: users.fullName,
          })
          .from(ranchMemberships)
          .innerJoin(users, eq(ranchMemberships.userId, users.id))
          .where(
            and(
              eq(ranchMemberships.ranchId, ranchId),
              inArray(ranchMemberships.id, creatorMembershipIds),
            ),
          )
      : [];
  const creatorNameByMembershipId = new Map(
    creatorRows.map((row) => [row.membershipId, row.fullName] as const),
  );
  const maintenanceRowsWithCreatorName = maintenanceRows.map((row) => ({
    ...row,
    createdByName: row.createdByMembershipId
      ? (creatorNameByMembershipId.get(row.createdByMembershipId) ?? null)
      : null,
  }));

  const openMaintenance = maintenanceRowsWithCreatorName
    .filter((row) => isOpenMaintenanceStatus(row.status))
    .sort((a, b) => {
      const aOverdue = isOverdueMaintenance(a);
      const bOverdue = isOverdueMaintenance(b);
      if (aOverdue !== bOverdue) {
        return aOverdue ? -1 : 1;
      }
      if (a.dueOn && b.dueOn && a.dueOn !== b.dueOn) {
        return a.dueOn.localeCompare(b.dueOn);
      }
      if (a.dueOn && !b.dueOn) return -1;
      if (!a.dueOn && b.dueOn) return 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  const completedMaintenance = maintenanceRowsWithCreatorName
    .filter((row) => row.status === "completed")
    .sort((a, b) => {
      if (a.completedOn && b.completedOn && a.completedOn !== b.completedOn) {
        return b.completedOn.localeCompare(a.completedOn);
      }
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
  const cancelledMaintenance = maintenanceRowsWithCreatorName
    .filter((row) => row.status === "cancelled")
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const overdueCount = openMaintenance.filter((row) => isOverdueMaintenance(row)).length;
  const nextDueOn = openMaintenance
    .map((row) => row.dueOn)
    .filter((dueOn): dueOn is string => Boolean(dueOn))
    .sort((a, b) => a.localeCompare(b))[0] ?? null;

  return {
    equipment,
    maintenanceSummary: {
      total: maintenanceRows.length,
      open: openMaintenance.length,
      completed: completedMaintenance.length,
      cancelled: cancelledMaintenance.length,
      overdue: overdueCount,
      nextDueOn,
    },
    openMaintenance,
    completedMaintenance,
    cancelledMaintenance,
  };
}

export async function getLinkableWorkOrderOptions(
  ranchId: string,
): Promise<LinkableWorkOrderOption[]> {
  return db
    .select({
      id: workOrders.id,
      title: workOrders.title,
      status: workOrders.status,
      dueAt: workOrders.dueAt,
    })
    .from(workOrders)
    .where(
      and(
        eq(workOrders.ranchId, ranchId),
        notInArray(workOrders.status, ["completed", "cancelled"]),
      ),
    )
    .orderBy(asc(workOrders.dueAt), desc(workOrders.createdAt))
    .limit(100);
}
