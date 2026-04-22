import { and, eq, inArray, isNotNull, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  ranchMemberships,
  workOrderAssignments,
  workOrders,
  workOrderTemplateAssignments,
  workOrderTemplates,
} from "@/lib/db/schema";
import { advanceRecurrenceDate, toDateKey } from "./recurrence";

function endOfDayUtc(dateKey: string): Date {
  return new Date(`${dateKey}T23:59:00Z`);
}

const MAX_GENERATION_CYCLES = 32;

export async function materializeDueRecurringWorkOrdersForRanch(
  ranchId: string,
): Promise<number> {
  const todayKey = toDateKey(new Date());
  const recurringTemplates = await db
    .select({
      id: workOrderTemplates.id,
      title: workOrderTemplates.title,
      description: workOrderTemplates.description,
      priority: workOrderTemplates.priority,
      compensationType: workOrderTemplates.compensationType,
      flatPayCents: workOrderTemplates.flatPayCents,
      incentivePayCents: workOrderTemplates.incentivePayCents,
      incentiveTimerType: workOrderTemplates.incentiveTimerType,
      incentiveDurationHours: workOrderTemplates.incentiveDurationHours,
      recurrenceCadence: workOrderTemplates.recurrenceCadence,
      recurrenceIntervalDays: workOrderTemplates.recurrenceIntervalDays,
      nextGenerationOn: workOrderTemplates.nextGenerationOn,
      createdByMembershipId: workOrderTemplates.createdByMembershipId,
    })
    .from(workOrderTemplates)
    .where(
      and(
        eq(workOrderTemplates.ranchId, ranchId),
        eq(workOrderTemplates.isActive, true),
        eq(workOrderTemplates.recurringEnabled, true),
        isNotNull(workOrderTemplates.nextGenerationOn),
        lte(workOrderTemplates.nextGenerationOn, todayKey),
      ),
    );

  if (!recurringTemplates.length) {
    return 0;
  }

  const assignmentRows = await db
    .select({
      templateId: workOrderTemplateAssignments.templateId,
      membershipId: workOrderTemplateAssignments.membershipId,
    })
    .from(workOrderTemplateAssignments)
    .innerJoin(
      ranchMemberships,
      eq(workOrderTemplateAssignments.membershipId, ranchMemberships.id),
    )
    .where(
      and(
        eq(workOrderTemplateAssignments.ranchId, ranchId),
        inArray(
          workOrderTemplateAssignments.templateId,
          recurringTemplates.map((template) => template.id),
        ),
        eq(ranchMemberships.isActive, true),
      ),
    );

  const assignmentMap = new Map<string, string[]>();
  for (const row of assignmentRows) {
    const current = assignmentMap.get(row.templateId) ?? [];
    current.push(row.membershipId);
    assignmentMap.set(row.templateId, current);
  }

  let generatedCount = 0;

  for (const template of recurringTemplates) {
    if (!template.nextGenerationOn || !template.recurrenceCadence) {
      continue;
    }

    let generationDate = template.nextGenerationOn;
    let cycleCount = 0;

    while (generationDate <= todayKey && cycleCount < MAX_GENERATION_CYCLES) {
      const incentiveEndsAt =
        template.incentiveTimerType === "hours" && template.incentiveDurationHours
          ? new Date(
              endOfDayUtc(generationDate).getTime() +
                template.incentiveDurationHours * 60 * 60 * 1000,
            )
          : null;

      const [created] = await db
        .insert(workOrders)
        .values({
          ranchId,
          title: template.title,
          description: template.description,
          status: "open",
          priority: template.priority,
          dueAt: endOfDayUtc(generationDate),
          completedAt: null,
          compensationType: template.compensationType,
          flatPayCents: template.flatPayCents,
          incentivePayCents: template.incentivePayCents,
          incentiveTimerType: template.incentiveTimerType,
          incentiveDurationHours: template.incentiveDurationHours,
          incentiveEndsAt,
          templateId: template.id,
          generatedForDate: generationDate,
          createdByMembershipId: template.createdByMembershipId,
        })
        .onConflictDoNothing({
          target: [workOrders.templateId, workOrders.generatedForDate],
        })
        .returning({ id: workOrders.id });

      if (created) {
        generatedCount += 1;
        const defaultAssignees = assignmentMap.get(template.id) ?? [];
        if (defaultAssignees.length) {
          await db.insert(workOrderAssignments).values(
            defaultAssignees.map((membershipId) => ({
              workOrderId: created.id,
              membershipId,
            })),
          );
        }
      }

      generationDate = advanceRecurrenceDate(
        generationDate,
        template.recurrenceCadence,
        template.recurrenceIntervalDays,
      );
      cycleCount += 1;
    }

    await db
      .update(workOrderTemplates)
      .set({
        nextGenerationOn: generationDate,
        updatedAt: new Date(),
      })
      .where(eq(workOrderTemplates.id, template.id));
  }

  return generatedCount;
}
