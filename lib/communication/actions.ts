"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSectionManage } from "@/lib/auth/context";
import { db } from "@/lib/db/client";
import { ranchDirectMessages, ranchMemberships, ranchMessages } from "@/lib/db/schema";

export interface CommunicationActionState {
  error?: string;
  success?: string;
}

const threadSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters.")
    .max(120, "Title must be 120 characters or less."),
  body: z
    .string()
    .trim()
    .min(1, "Message cannot be empty.")
    .max(4000, "Message must be 4,000 characters or less."),
  priority: z.enum(["normal", "urgent"]).default("normal"),
});

const replySchema = z.object({
  parentMessageId: z.string().uuid(),
  body: z
    .string()
    .trim()
    .min(1, "Reply cannot be empty.")
    .max(4000, "Reply must be 4,000 characters or less."),
});

const privateMessageSchema = z.object({
  recipientMembershipId: z.string().uuid(),
  body: z
    .string()
    .trim()
    .min(1, "Message cannot be empty.")
    .max(4000, "Message must be 4,000 characters or less."),
});

export async function createRanchMessageAction(
  _prevState: CommunicationActionState,
  formData: FormData,
): Promise<CommunicationActionState> {
  const context = await requireSectionManage("communication");
  const parsed = threadSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    priority: formData.get("priority"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid message details.",
    };
  }

  await db.insert(ranchMessages).values({
    ranchId: context.ranch.id,
    authorMembershipId: context.membership.id,
    title: parsed.data.title,
    body: parsed.data.body,
    priority: parsed.data.priority,
    parentMessageId: null,
  });

  revalidatePath("/app/communication");
  return { success: "Message posted." };
}

export async function createRanchReplyAction(
  _prevState: CommunicationActionState,
  formData: FormData,
): Promise<CommunicationActionState> {
  const context = await requireSectionManage("communication");
  const parsed = replySchema.safeParse({
    parentMessageId: formData.get("parentMessageId"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid reply details.",
    };
  }

  const [message] = await db
    .select({
      id: ranchMessages.id,
      parentMessageId: ranchMessages.parentMessageId,
    })
    .from(ranchMessages)
    .where(
      and(
        eq(ranchMessages.id, parsed.data.parentMessageId),
        eq(ranchMessages.ranchId, context.ranch.id),
        isNull(ranchMessages.archivedAt),
      ),
    )
    .limit(1);

  if (!message) {
    return { error: "Thread not found for this ranch." };
  }

  const threadId = message.parentMessageId ?? message.id;
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(ranchMessages).values({
      ranchId: context.ranch.id,
      authorMembershipId: context.membership.id,
      parentMessageId: threadId,
      title: null,
      body: parsed.data.body,
      priority: "normal",
      createdAt: now,
      updatedAt: now,
    });

    await tx
      .update(ranchMessages)
      .set({ updatedAt: now })
      .where(
        and(
          eq(ranchMessages.id, threadId),
          eq(ranchMessages.ranchId, context.ranch.id),
          isNull(ranchMessages.parentMessageId),
          isNull(ranchMessages.archivedAt),
        ),
      );
  });

  revalidatePath("/app/communication");
  return { success: "Reply posted." };
}

export async function createPrivateMessageAction(
  _prevState: CommunicationActionState,
  formData: FormData,
): Promise<CommunicationActionState> {
  const context = await requireSectionManage("communication");
  const parsed = privateMessageSchema.safeParse({
    recipientMembershipId: formData.get("recipientMembershipId"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid private message details.",
    };
  }

  if (parsed.data.recipientMembershipId === context.membership.id) {
    return { error: "Choose another team member." };
  }

  const [recipient] = await db
    .select({
      id: ranchMemberships.id,
      isActive: ranchMemberships.isActive,
    })
    .from(ranchMemberships)
    .where(
      and(
        eq(ranchMemberships.id, parsed.data.recipientMembershipId),
        eq(ranchMemberships.ranchId, context.ranch.id),
      ),
    )
    .limit(1);

  if (!recipient) {
    return { error: "Team member not found for this ranch." };
  }

  if (!recipient.isActive) {
    return { error: "This team member is inactive." };
  }

  await db.insert(ranchDirectMessages).values({
    ranchId: context.ranch.id,
    senderMembershipId: context.membership.id,
    recipientMembershipId: recipient.id,
    body: parsed.data.body,
    isRead: false,
    readAt: null,
  });

  revalidatePath("/app/communication");
  return { success: "Private message sent." };
}
