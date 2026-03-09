import { and, desc, eq, ilike, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  ranchMemberships,
  users,
  workOrderAssignments,
  workOrders,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from "@/lib/db/schema";

export interface AssignableMember {
  membershipId: string;
  fullName: string;
  role: "owner" | "manager" | "worker";
  isActive: boolean;
}

export interface WorkOrderListItem {
  id: string;
  title: string;
  description: string | null;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  dueAt: Date | null;
  createdAt: Date;
  assignees: { membershipId: string; fullName: string }[];
}

export interface WorkOrderDetail extends WorkOrderListItem {
  assignedMembershipIds: string[];
}

export async function getAssignableMembersForRanch(
  ranchId: string,
): Promise<AssignableMember[]> {
  return db
    .select({
      membershipId: ranchMemberships.id,
      fullName: users.fullName,
      role: ranchMemberships.role,
      isActive: ranchMemberships.isActive,
    })
    .from(ranchMemberships)
    .innerJoin(users, eq(ranchMemberships.userId, users.id))
    .where(eq(ranchMemberships.ranchId, ranchId));
}

export async function getWorkOrdersForRanch(
  ranchId: string,
  options: {
    status?: WorkOrderStatus | "all";
    search?: string;
  } = {},
): Promise<WorkOrderListItem[]> {
  const conditions = [eq(workOrders.ranchId, ranchId)];
  if (options.status && options.status !== "all") {
    conditions.push(eq(workOrders.status, options.status));
  }
  if (options.search?.trim()) {
    conditions.push(ilike(workOrders.title, `%${options.search.trim()}%`));
  }

  const orderRows = await db
    .select({
      id: workOrders.id,
      title: workOrders.title,
      description: workOrders.description,
      status: workOrders.status,
      priority: workOrders.priority,
      dueAt: workOrders.dueAt,
      createdAt: workOrders.createdAt,
    })
    .from(workOrders)
    .where(and(...conditions))
    .orderBy(desc(workOrders.createdAt));

  if (!orderRows.length) {
    return [];
  }

  const assignmentRows = await db
    .select({
      workOrderId: workOrderAssignments.workOrderId,
      membershipId: workOrderAssignments.membershipId,
      fullName: users.fullName,
    })
    .from(workOrderAssignments)
    .innerJoin(
      ranchMemberships,
      eq(workOrderAssignments.membershipId, ranchMemberships.id),
    )
    .innerJoin(users, eq(ranchMemberships.userId, users.id))
    .where(inArray(workOrderAssignments.workOrderId, orderRows.map((order) => order.id)));

  const assigneeMap = new Map<
    string,
    { membershipId: string; fullName: string }[]
  >();

  for (const assignment of assignmentRows) {
    const current = assigneeMap.get(assignment.workOrderId) ?? [];
    current.push({
      membershipId: assignment.membershipId,
      fullName: assignment.fullName,
    });
    assigneeMap.set(assignment.workOrderId, current);
  }

  return orderRows.map((order) => ({
    ...order,
    assignees: assigneeMap.get(order.id) ?? [],
  }));
}

export async function getWorkOrderById(
  ranchId: string,
  workOrderId: string,
): Promise<WorkOrderDetail | null> {
  const [order] = await db
    .select({
      id: workOrders.id,
      title: workOrders.title,
      description: workOrders.description,
      status: workOrders.status,
      priority: workOrders.priority,
      dueAt: workOrders.dueAt,
      createdAt: workOrders.createdAt,
    })
    .from(workOrders)
    .where(and(eq(workOrders.ranchId, ranchId), eq(workOrders.id, workOrderId)))
    .limit(1);

  if (!order) {
    return null;
  }

  const assignmentRows = await db
    .select({
      membershipId: workOrderAssignments.membershipId,
      fullName: users.fullName,
    })
    .from(workOrderAssignments)
    .innerJoin(
      ranchMemberships,
      eq(workOrderAssignments.membershipId, ranchMemberships.id),
    )
    .innerJoin(users, eq(ranchMemberships.userId, users.id))
    .where(eq(workOrderAssignments.workOrderId, order.id));

  return {
    ...order,
    assignees: assignmentRows.map((row) => ({
      membershipId: row.membershipId,
      fullName: row.fullName,
    })),
    assignedMembershipIds: assignmentRows.map((row) => row.membershipId),
  };
}

export async function getAssignedWorkForMembership(
  ranchId: string,
  membershipId: string,
): Promise<WorkOrderListItem[]> {
  const rows = await db
    .select({
      id: workOrders.id,
      title: workOrders.title,
      description: workOrders.description,
      status: workOrders.status,
      priority: workOrders.priority,
      dueAt: workOrders.dueAt,
      createdAt: workOrders.createdAt,
    })
    .from(workOrderAssignments)
    .innerJoin(workOrders, eq(workOrderAssignments.workOrderId, workOrders.id))
    .where(
      and(
        eq(workOrders.ranchId, ranchId),
        eq(workOrderAssignments.membershipId, membershipId),
      ),
    )
    .orderBy(desc(workOrders.updatedAt));

  return rows.map((row) => ({
    ...row,
    assignees: [],
  }));
}
