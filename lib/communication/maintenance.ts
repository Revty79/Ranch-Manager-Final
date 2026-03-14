import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { ranchDirectMessages, ranchMessages } from "@/lib/db/schema";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function archiveStaleCommunicationForRanch(
  ranchId: string,
  retentionDays = 30,
): Promise<void> {
  const cutoff = new Date(Date.now() - retentionDays * MS_PER_DAY);
  const now = new Date();

  await db.transaction(async (tx) => {
    const staleThreads = await tx
      .select({ id: ranchMessages.id })
      .from(ranchMessages)
      .where(
        and(
          eq(ranchMessages.ranchId, ranchId),
          isNull(ranchMessages.parentMessageId),
          isNull(ranchMessages.archivedAt),
          lt(ranchMessages.updatedAt, cutoff),
        ),
      );

    if (staleThreads.length) {
      const staleThreadIds = staleThreads.map((thread) => thread.id);
      await tx
        .update(ranchMessages)
        .set({
          archivedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(ranchMessages.ranchId, ranchId),
            isNull(ranchMessages.archivedAt),
            or(
              inArray(ranchMessages.id, staleThreadIds),
              inArray(ranchMessages.parentMessageId, staleThreadIds),
            ),
          ),
        );
    }

    await tx
      .update(ranchDirectMessages)
      .set({
        archivedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(ranchDirectMessages.ranchId, ranchId),
          isNull(ranchDirectMessages.archivedAt),
          lt(ranchDirectMessages.createdAt, cutoff),
        ),
      );
  });
}
