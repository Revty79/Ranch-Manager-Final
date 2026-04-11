import { and, desc, eq, ilike, inArray } from "drizzle-orm";
import { isPlatformAdminEmail } from "@/lib/auth/platform-admin";
import { db } from "@/lib/db/client";
import {
  ranchMemberships,
  users,
  workOrderCompletionReviews,
  workOrderAssignments,
  workOrders,
  type WorkOrderCompensationType,
  type WorkOrderCompletionReviewStatus,
  type WorkOrderIncentiveTimerType,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from "@/lib/db/schema";

export interface AssignableMember {
  membershipId: string;
  fullName: string;
  role: "owner" | "manager" | "worker" | "seasonal_worker";
  isActive: boolean;
}

export interface WorkOrderListItem {
  id: string;
  title: string;
  description: string | null;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  dueAt: Date | null;
  compensationType: WorkOrderCompensationType;
  flatPayCents: number;
  incentivePayCents: number;
  incentiveTimerType: WorkOrderIncentiveTimerType;
  incentiveDurationHours: number | null;
  incentiveEndsAt: Date | null;
  completionReviewStatus: WorkOrderCompletionReviewStatus | null;
  completionReviewRequestedAt: Date | null;
  completionReviewReviewedAt: Date | null;
  createdAt: Date;
  assignees: { membershipId: string; fullName: string }[];
}

export interface WorkOrderCompletionReviewDetail {
  status: WorkOrderCompletionReviewStatus;
  requestedByMembershipId: string | null;
  requestedByFullName: string | null;
  requestedAt: Date;
  reviewedByMembershipId: string | null;
  reviewedByFullName: string | null;
  reviewedAt: Date | null;
  managerNotes: string | null;
  checklistCompletionVerified: boolean;
  checklistQualityVerified: boolean;
  checklistCleanupVerified: boolean;
  checklistFollowUpVerified: boolean;
}

export interface WorkOrderDetail extends WorkOrderListItem {
  assignedMembershipIds: string[];
  completionReview: WorkOrderCompletionReviewDetail | null;
}

export async function getAssignableMembersForRanch(
  ranchId: string,
): Promise<AssignableMember[]> {
  const rows = await db
    .select({
      membershipId: ranchMemberships.id,
      fullName: users.fullName,
      email: users.email,
      role: ranchMemberships.role,
      isActive: ranchMemberships.isActive,
    })
    .from(ranchMemberships)
    .innerJoin(users, eq(ranchMemberships.userId, users.id))
    .where(eq(ranchMemberships.ranchId, ranchId));

  return rows
    .filter((row) => !isPlatformAdminEmail(row.email))
    .map((row) => ({
      membershipId: row.membershipId,
      fullName: row.fullName,
      role: row.role,
      isActive: row.isActive,
    }));
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
      compensationType: workOrders.compensationType,
      flatPayCents: workOrders.flatPayCents,
      incentivePayCents: workOrders.incentivePayCents,
      incentiveTimerType: workOrders.incentiveTimerType,
      incentiveDurationHours: workOrders.incentiveDurationHours,
      incentiveEndsAt: workOrders.incentiveEndsAt,
      completionReviewStatus: workOrderCompletionReviews.status,
      completionReviewRequestedAt: workOrderCompletionReviews.requestedAt,
      completionReviewReviewedAt: workOrderCompletionReviews.reviewedAt,
      createdAt: workOrders.createdAt,
    })
    .from(workOrders)
    .leftJoin(
      workOrderCompletionReviews,
      eq(workOrderCompletionReviews.workOrderId, workOrders.id),
    )
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
      email: users.email,
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
    if (isPlatformAdminEmail(assignment.email)) {
      continue;
    }

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
      compensationType: workOrders.compensationType,
      flatPayCents: workOrders.flatPayCents,
      incentivePayCents: workOrders.incentivePayCents,
      incentiveTimerType: workOrders.incentiveTimerType,
      incentiveDurationHours: workOrders.incentiveDurationHours,
      incentiveEndsAt: workOrders.incentiveEndsAt,
      completionReviewStatus: workOrderCompletionReviews.status,
      completionReviewRequestedAt: workOrderCompletionReviews.requestedAt,
      completionReviewReviewedAt: workOrderCompletionReviews.reviewedAt,
      createdAt: workOrders.createdAt,
    })
    .from(workOrders)
    .leftJoin(
      workOrderCompletionReviews,
      eq(workOrderCompletionReviews.workOrderId, workOrders.id),
    )
    .where(and(eq(workOrders.ranchId, ranchId), eq(workOrders.id, workOrderId)))
    .limit(1);

  if (!order) {
    return null;
  }

  const assignmentRows = await db
    .select({
      membershipId: workOrderAssignments.membershipId,
      fullName: users.fullName,
      email: users.email,
    })
    .from(workOrderAssignments)
    .innerJoin(
      ranchMemberships,
      eq(workOrderAssignments.membershipId, ranchMemberships.id),
    )
    .innerJoin(users, eq(ranchMemberships.userId, users.id))
    .where(eq(workOrderAssignments.workOrderId, order.id));

  const visibleAssignments = assignmentRows.filter(
    (assignment) => !isPlatformAdminEmail(assignment.email),
  );

  const [reviewRow] = await db
    .select({
      status: workOrderCompletionReviews.status,
      requestedByMembershipId: workOrderCompletionReviews.requestedByMembershipId,
      requestedAt: workOrderCompletionReviews.requestedAt,
      reviewedByMembershipId: workOrderCompletionReviews.reviewedByMembershipId,
      reviewedAt: workOrderCompletionReviews.reviewedAt,
      managerNotes: workOrderCompletionReviews.managerNotes,
      checklistCompletionVerified: workOrderCompletionReviews.checklistCompletionVerified,
      checklistQualityVerified: workOrderCompletionReviews.checklistQualityVerified,
      checklistCleanupVerified: workOrderCompletionReviews.checklistCleanupVerified,
      checklistFollowUpVerified: workOrderCompletionReviews.checklistFollowUpVerified,
    })
    .from(workOrderCompletionReviews)
    .where(eq(workOrderCompletionReviews.workOrderId, order.id))
    .limit(1);

  let completionReview: WorkOrderCompletionReviewDetail | null = null;
  if (reviewRow) {
    const membershipIds = [
      ...new Set(
        [reviewRow.requestedByMembershipId, reviewRow.reviewedByMembershipId].filter(
          (membershipId): membershipId is string => Boolean(membershipId),
        ),
      ),
    ];

    const reviewMemberRows =
      membershipIds.length > 0
        ? await db
            .select({
              membershipId: ranchMemberships.id,
              fullName: users.fullName,
              email: users.email,
            })
            .from(ranchMemberships)
            .innerJoin(users, eq(ranchMemberships.userId, users.id))
            .where(inArray(ranchMemberships.id, membershipIds))
        : [];

    const reviewNameMap = new Map(
      reviewMemberRows
        .filter((member) => !isPlatformAdminEmail(member.email))
        .map((member) => [member.membershipId, member.fullName]),
    );

    completionReview = {
      status: reviewRow.status,
      requestedByMembershipId: reviewRow.requestedByMembershipId,
      requestedByFullName: reviewRow.requestedByMembershipId
        ? (reviewNameMap.get(reviewRow.requestedByMembershipId) ?? null)
        : null,
      requestedAt: reviewRow.requestedAt,
      reviewedByMembershipId: reviewRow.reviewedByMembershipId,
      reviewedByFullName: reviewRow.reviewedByMembershipId
        ? (reviewNameMap.get(reviewRow.reviewedByMembershipId) ?? null)
        : null,
      reviewedAt: reviewRow.reviewedAt,
      managerNotes: reviewRow.managerNotes,
      checklistCompletionVerified: reviewRow.checklistCompletionVerified,
      checklistQualityVerified: reviewRow.checklistQualityVerified,
      checklistCleanupVerified: reviewRow.checklistCleanupVerified,
      checklistFollowUpVerified: reviewRow.checklistFollowUpVerified,
    };
  }

  return {
    ...order,
    assignees: visibleAssignments.map((row) => ({
      membershipId: row.membershipId,
      fullName: row.fullName,
    })),
    assignedMembershipIds: visibleAssignments.map((row) => row.membershipId),
    completionReview,
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
      compensationType: workOrders.compensationType,
      flatPayCents: workOrders.flatPayCents,
      incentivePayCents: workOrders.incentivePayCents,
      incentiveTimerType: workOrders.incentiveTimerType,
      incentiveDurationHours: workOrders.incentiveDurationHours,
      incentiveEndsAt: workOrders.incentiveEndsAt,
      completionReviewStatus: workOrderCompletionReviews.status,
      completionReviewRequestedAt: workOrderCompletionReviews.requestedAt,
      completionReviewReviewedAt: workOrderCompletionReviews.reviewedAt,
      createdAt: workOrders.createdAt,
    })
    .from(workOrderAssignments)
    .innerJoin(workOrders, eq(workOrderAssignments.workOrderId, workOrders.id))
    .leftJoin(
      workOrderCompletionReviews,
      eq(workOrderCompletionReviews.workOrderId, workOrders.id),
    )
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
