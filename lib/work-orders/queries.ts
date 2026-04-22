import { and, desc, eq, ilike, inArray } from "drizzle-orm";
import { isPlatformAdminEmail } from "@/lib/auth/platform-admin";
import { db } from "@/lib/db/client";
import {
  ranchMemberships,
  users,
  workOrderCompletionEvidence,
  workOrderCompletionReviews,
  workOrderCompletionSubmissions,
  workOrderAssignments,
  workOrders,
  type WorkOrderCompensationType,
  type WorkOrderCompletionEvidenceType,
  type WorkOrderCompletionReviewStatus,
  type WorkOrderIncentiveTimerType,
  type WorkOrderPriority,
  type WorkOrderRecurrenceCadence,
  type WorkOrderStatus,
  workOrderTemplateAssignments,
  workOrderTemplates,
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

export interface WorkOrderTemplateListItem {
  id: string;
  templateName: string;
  title: string;
  description: string | null;
  priority: WorkOrderPriority;
  compensationType: WorkOrderCompensationType;
  flatPayCents: number;
  incentivePayCents: number;
  incentiveTimerType: WorkOrderIncentiveTimerType;
  incentiveDurationHours: number | null;
  isActive: boolean;
  recurringEnabled: boolean;
  recurrenceCadence: WorkOrderRecurrenceCadence | null;
  recurrenceIntervalDays: number | null;
  nextGenerationOn: string | null;
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
  workerSubmission: WorkerCompletionSubmissionDetail | null;
}

export interface WorkerCompletionEvidenceDetail {
  id: string;
  evidenceType: WorkOrderCompletionEvidenceType;
  label: string | null;
  url: string | null;
  notes: string | null;
  createdAt: Date;
}

export interface WorkerCompletionSubmissionDetail {
  submittedByMembershipId: string | null;
  submittedByFullName: string | null;
  submittedAt: Date;
  completionNote: string | null;
  checklistScopeCompleted: boolean;
  checklistQualityChecked: boolean;
  checklistCleanupCompleted: boolean;
  checklistFollowUpNoted: boolean;
  evidence: WorkerCompletionEvidenceDetail[];
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

export async function getWorkOrderTemplatesForRanch(
  ranchId: string,
): Promise<WorkOrderTemplateListItem[]> {
  const templateRows = await db
    .select({
      id: workOrderTemplates.id,
      templateName: workOrderTemplates.templateName,
      title: workOrderTemplates.title,
      description: workOrderTemplates.description,
      priority: workOrderTemplates.priority,
      compensationType: workOrderTemplates.compensationType,
      flatPayCents: workOrderTemplates.flatPayCents,
      incentivePayCents: workOrderTemplates.incentivePayCents,
      incentiveTimerType: workOrderTemplates.incentiveTimerType,
      incentiveDurationHours: workOrderTemplates.incentiveDurationHours,
      isActive: workOrderTemplates.isActive,
      recurringEnabled: workOrderTemplates.recurringEnabled,
      recurrenceCadence: workOrderTemplates.recurrenceCadence,
      recurrenceIntervalDays: workOrderTemplates.recurrenceIntervalDays,
      nextGenerationOn: workOrderTemplates.nextGenerationOn,
      createdAt: workOrderTemplates.createdAt,
    })
    .from(workOrderTemplates)
    .where(eq(workOrderTemplates.ranchId, ranchId))
    .orderBy(desc(workOrderTemplates.createdAt));

  if (!templateRows.length) {
    return [];
  }

  const assignmentRows = await db
    .select({
      templateId: workOrderTemplateAssignments.templateId,
      membershipId: workOrderTemplateAssignments.membershipId,
      fullName: users.fullName,
      email: users.email,
    })
    .from(workOrderTemplateAssignments)
    .innerJoin(
      ranchMemberships,
      eq(workOrderTemplateAssignments.membershipId, ranchMemberships.id),
    )
    .innerJoin(users, eq(ranchMemberships.userId, users.id))
    .where(
      and(
        eq(workOrderTemplateAssignments.ranchId, ranchId),
        inArray(
          workOrderTemplateAssignments.templateId,
          templateRows.map((template) => template.id),
        ),
      ),
    );

  const assigneeMap = new Map<string, { membershipId: string; fullName: string }[]>();
  for (const row of assignmentRows) {
    if (isPlatformAdminEmail(row.email)) {
      continue;
    }
    const current = assigneeMap.get(row.templateId) ?? [];
    current.push({
      membershipId: row.membershipId,
      fullName: row.fullName,
    });
    assigneeMap.set(row.templateId, current);
  }

  return templateRows.map((template) => ({
    ...template,
    assignees: assigneeMap.get(template.id) ?? [],
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

  const [submissionRow] = await db
    .select({
      id: workOrderCompletionSubmissions.id,
      submittedByMembershipId: workOrderCompletionSubmissions.submittedByMembershipId,
      submittedAt: workOrderCompletionSubmissions.submittedAt,
      completionNote: workOrderCompletionSubmissions.completionNote,
      checklistScopeCompleted: workOrderCompletionSubmissions.checklistScopeCompleted,
      checklistQualityChecked: workOrderCompletionSubmissions.checklistQualityChecked,
      checklistCleanupCompleted: workOrderCompletionSubmissions.checklistCleanupCompleted,
      checklistFollowUpNoted: workOrderCompletionSubmissions.checklistFollowUpNoted,
    })
    .from(workOrderCompletionSubmissions)
    .where(eq(workOrderCompletionSubmissions.workOrderId, order.id))
    .limit(1);

  const evidenceRows = submissionRow
    ? await db
        .select({
          id: workOrderCompletionEvidence.id,
          evidenceType: workOrderCompletionEvidence.evidenceType,
          label: workOrderCompletionEvidence.label,
          url: workOrderCompletionEvidence.url,
          notes: workOrderCompletionEvidence.notes,
          createdAt: workOrderCompletionEvidence.createdAt,
        })
        .from(workOrderCompletionEvidence)
        .where(eq(workOrderCompletionEvidence.submissionId, submissionRow.id))
        .orderBy(desc(workOrderCompletionEvidence.createdAt))
    : [];

  let completionReview: WorkOrderCompletionReviewDetail | null = null;
  if (reviewRow) {
    const membershipIds = [
      ...new Set(
        [
          reviewRow.requestedByMembershipId,
          reviewRow.reviewedByMembershipId,
          submissionRow?.submittedByMembershipId ?? null,
        ].filter(
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
      workerSubmission: submissionRow
        ? {
            submittedByMembershipId: submissionRow.submittedByMembershipId,
            submittedByFullName: submissionRow.submittedByMembershipId
              ? (reviewNameMap.get(submissionRow.submittedByMembershipId) ?? null)
              : null,
            submittedAt: submissionRow.submittedAt,
            completionNote: submissionRow.completionNote,
            checklistScopeCompleted: submissionRow.checklistScopeCompleted,
            checklistQualityChecked: submissionRow.checklistQualityChecked,
            checklistCleanupCompleted: submissionRow.checklistCleanupCompleted,
            checklistFollowUpNoted: submissionRow.checklistFollowUpNoted,
            evidence: evidenceRows.map((evidence) => ({
              id: evidence.id,
              evidenceType: evidence.evidenceType,
              label: evidence.label,
              url: evidence.url,
              notes: evidence.notes,
              createdAt: evidence.createdAt,
            })),
          }
        : null,
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
