import { and, asc, desc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { isPlatformAdminEmail } from "@/lib/auth/platform-admin";
import { db } from "@/lib/db/client";
import {
  ranchDirectMessages,
  ranchMemberships,
  ranchMessages,
  users,
  type RanchMessagePriority,
  type RanchRole,
} from "@/lib/db/schema";

interface MessageAuthor {
  membershipId: string | null;
  fullName: string | null;
  role: RanchRole | null;
}

export interface RanchMessageReply {
  id: string;
  parentMessageId: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  author: MessageAuthor;
}

export interface RanchMessageThread {
  id: string;
  title: string | null;
  body: string;
  priority: RanchMessagePriority;
  createdAt: Date;
  updatedAt: Date;
  latestActivityAt: Date;
  replyCount: number;
  author: MessageAuthor;
  replies: RanchMessageReply[];
}

export interface PrivateMessageMemberOption {
  membershipId: string;
  fullName: string;
  role: RanchRole;
  isActive: boolean;
}

export interface PrivateConversationMember {
  membershipId: string;
  fullName: string;
  role: RanchRole | null;
  isActive: boolean;
}

export interface PrivateConversationSummary {
  otherMembershipId: string;
  otherFullName: string;
  otherRole: RanchRole | null;
  otherIsActive: boolean;
  latestMessageBody: string;
  latestMessageAt: Date;
  latestDirection: "sent" | "received";
  unreadCount: number;
}

export interface PrivateConversationMessage {
  id: string;
  senderMembershipId: string | null;
  recipientMembershipId: string | null;
  body: string;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PrivateMessagingWorkspace {
  members: PrivateMessageMemberOption[];
  conversations: PrivateConversationSummary[];
  selectedMembershipId: string | null;
  selectedMember: PrivateConversationMember | null;
  messages: PrivateConversationMessage[];
  totalUnreadCount: number;
}

export type CommunicationArchiveView = "active" | "archived";

function buildAuthor(row: {
  authorMembershipId: string | null;
  authorFullName: string | null;
  authorRole: RanchRole | null;
}): MessageAuthor {
  return {
    membershipId: row.authorMembershipId,
    fullName: row.authorFullName,
    role: row.authorRole,
  };
}

export async function getRanchMessageThreads(
  ranchId: string,
  options?: { archiveView?: CommunicationArchiveView },
): Promise<RanchMessageThread[]> {
  const archiveView = options?.archiveView ?? "active";
  const archiveFilter =
    archiveView === "archived"
      ? isNotNull(ranchMessages.archivedAt)
      : isNull(ranchMessages.archivedAt);

  const threadRows = await db
    .select({
      id: ranchMessages.id,
      title: ranchMessages.title,
      body: ranchMessages.body,
      priority: ranchMessages.priority,
      createdAt: ranchMessages.createdAt,
      updatedAt: ranchMessages.updatedAt,
      authorMembershipId: ranchMessages.authorMembershipId,
      authorFullName: users.fullName,
      authorRole: ranchMemberships.role,
    })
    .from(ranchMessages)
    .leftJoin(
      ranchMemberships,
      eq(ranchMessages.authorMembershipId, ranchMemberships.id),
    )
    .leftJoin(users, eq(ranchMemberships.userId, users.id))
    .where(
      and(
        eq(ranchMessages.ranchId, ranchId),
        isNull(ranchMessages.parentMessageId),
        archiveFilter,
      ),
    )
    .orderBy(desc(ranchMessages.updatedAt), desc(ranchMessages.createdAt));

  if (!threadRows.length) {
    return [];
  }

  const threadIds = threadRows.map((thread) => thread.id);
  const replyRows = await db
    .select({
      id: ranchMessages.id,
      parentMessageId: ranchMessages.parentMessageId,
      body: ranchMessages.body,
      createdAt: ranchMessages.createdAt,
      updatedAt: ranchMessages.updatedAt,
      authorMembershipId: ranchMessages.authorMembershipId,
      authorFullName: users.fullName,
      authorRole: ranchMemberships.role,
    })
    .from(ranchMessages)
    .leftJoin(
      ranchMemberships,
      eq(ranchMessages.authorMembershipId, ranchMemberships.id),
    )
    .leftJoin(users, eq(ranchMemberships.userId, users.id))
    .where(
      and(
        eq(ranchMessages.ranchId, ranchId),
        inArray(ranchMessages.parentMessageId, threadIds),
        archiveFilter,
      ),
    )
    .orderBy(asc(ranchMessages.createdAt));

  const repliesByThreadId = new Map<string, RanchMessageReply[]>();
  for (const row of replyRows) {
    if (!row.parentMessageId) {
      continue;
    }

    const nextReply: RanchMessageReply = {
      id: row.id,
      parentMessageId: row.parentMessageId,
      body: row.body,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      author: buildAuthor(row),
    };

    const currentReplies = repliesByThreadId.get(row.parentMessageId) ?? [];
    currentReplies.push(nextReply);
    repliesByThreadId.set(row.parentMessageId, currentReplies);
  }

  return threadRows.map((thread) => {
    const replies = repliesByThreadId.get(thread.id) ?? [];
    const latestReplyAt = replies[replies.length - 1]?.createdAt ?? null;
    const latestActivityAt =
      latestReplyAt && latestReplyAt > thread.updatedAt
        ? latestReplyAt
        : thread.updatedAt;

    return {
      id: thread.id,
      title: thread.title,
      body: thread.body,
      priority: thread.priority,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      latestActivityAt,
      replyCount: replies.length,
      author: buildAuthor(thread),
      replies,
    };
  });
}

export async function markPrivateConversationAsRead(params: {
  ranchId: string;
  currentMembershipId: string;
  otherMembershipId: string;
}): Promise<void> {
  if (
    !params.otherMembershipId ||
    params.otherMembershipId === params.currentMembershipId
  ) {
    return;
  }

  const now = new Date();
  await db
    .update(ranchDirectMessages)
    .set({
      isRead: true,
      readAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(ranchDirectMessages.ranchId, params.ranchId),
        eq(ranchDirectMessages.senderMembershipId, params.otherMembershipId),
        eq(ranchDirectMessages.recipientMembershipId, params.currentMembershipId),
        eq(ranchDirectMessages.isRead, false),
        isNull(ranchDirectMessages.archivedAt),
      ),
    );
}

function resolveOtherMembershipId(
  message: {
    senderMembershipId: string | null;
    recipientMembershipId: string | null;
  },
  currentMembershipId: string,
): string | null {
  if (message.senderMembershipId === currentMembershipId) {
    return message.recipientMembershipId;
  }
  if (message.recipientMembershipId === currentMembershipId) {
    return message.senderMembershipId;
  }
  return null;
}

export async function getPrivateMessagingWorkspace(params: {
  ranchId: string;
  currentMembershipId: string;
  selectedOtherMembershipId?: string | null;
  archiveView?: CommunicationArchiveView;
}): Promise<PrivateMessagingWorkspace> {
  const archiveView = params.archiveView ?? "active";
  const archiveFilter =
    archiveView === "archived"
      ? isNotNull(ranchDirectMessages.archivedAt)
      : isNull(ranchDirectMessages.archivedAt);

  const [memberRows, messageRows] = await Promise.all([
    db
      .select({
        membershipId: ranchMemberships.id,
        fullName: users.fullName,
        email: users.email,
        role: ranchMemberships.role,
        isActive: ranchMemberships.isActive,
      })
      .from(ranchMemberships)
      .innerJoin(users, eq(ranchMemberships.userId, users.id))
      .where(eq(ranchMemberships.ranchId, params.ranchId))
      .orderBy(asc(users.fullName)),
    db
      .select({
        id: ranchDirectMessages.id,
        senderMembershipId: ranchDirectMessages.senderMembershipId,
        recipientMembershipId: ranchDirectMessages.recipientMembershipId,
        body: ranchDirectMessages.body,
        isRead: ranchDirectMessages.isRead,
        readAt: ranchDirectMessages.readAt,
        createdAt: ranchDirectMessages.createdAt,
        updatedAt: ranchDirectMessages.updatedAt,
      })
      .from(ranchDirectMessages)
      .where(
        and(
          eq(ranchDirectMessages.ranchId, params.ranchId),
          archiveFilter,
          or(
            eq(ranchDirectMessages.senderMembershipId, params.currentMembershipId),
            eq(ranchDirectMessages.recipientMembershipId, params.currentMembershipId),
          ),
        ),
      )
      .orderBy(desc(ranchDirectMessages.createdAt))
      .limit(400),
  ]);

  const members = memberRows
    .filter(
      (row) =>
        !isPlatformAdminEmail(row.email) &&
        row.membershipId !== params.currentMembershipId,
    )
    .map((row) => ({
      membershipId: row.membershipId,
      fullName: row.fullName,
      role: row.role,
      isActive: row.isActive,
    }));

  const memberById = new Map(
    members.map((member) => [member.membershipId, member] as const),
  );

  const conversationMap = new Map<string, PrivateConversationSummary>();
  for (const message of messageRows) {
    const otherMembershipId = resolveOtherMembershipId(
      message,
      params.currentMembershipId,
    );
    if (!otherMembershipId) {
      continue;
    }

    const otherMember = memberById.get(otherMembershipId);
    const existing = conversationMap.get(otherMembershipId);
    if (!existing) {
      conversationMap.set(otherMembershipId, {
        otherMembershipId,
        otherFullName: otherMember?.fullName ?? "Former member",
        otherRole: otherMember?.role ?? null,
        otherIsActive: otherMember?.isActive ?? false,
        latestMessageBody: message.body,
        latestMessageAt: message.createdAt,
        latestDirection:
          message.senderMembershipId === params.currentMembershipId
            ? "sent"
            : "received",
        unreadCount: 0,
      });
    }

    if (
      message.recipientMembershipId === params.currentMembershipId &&
      !message.isRead
    ) {
      const nextSummary = conversationMap.get(otherMembershipId);
      if (nextSummary) {
        nextSummary.unreadCount += 1;
      }
    }
  }

  const conversations = [...conversationMap.values()].sort(
    (a, b) => b.latestMessageAt.getTime() - a.latestMessageAt.getTime(),
  );

  const selectedMembershipId =
    params.selectedOtherMembershipId &&
    params.selectedOtherMembershipId !== params.currentMembershipId &&
    (memberById.has(params.selectedOtherMembershipId) ||
      conversationMap.has(params.selectedOtherMembershipId))
      ? params.selectedOtherMembershipId
      : null;

  const selectedMember = selectedMembershipId
    ? ({
        membershipId: selectedMembershipId,
        fullName: memberById.get(selectedMembershipId)?.fullName ?? "Former member",
        role: memberById.get(selectedMembershipId)?.role ?? null,
        isActive: memberById.get(selectedMembershipId)?.isActive ?? false,
      } satisfies PrivateConversationMember)
    : null;

  const messages = selectedMembershipId
    ? messageRows
        .filter((message) => {
          const isFromCurrentToSelected =
            message.senderMembershipId === params.currentMembershipId &&
            message.recipientMembershipId === selectedMembershipId;
          const isFromSelectedToCurrent =
            message.senderMembershipId === selectedMembershipId &&
            message.recipientMembershipId === params.currentMembershipId;
          return isFromCurrentToSelected || isFromSelectedToCurrent;
        })
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    : [];

  const totalUnreadCount = conversations.reduce(
    (total, conversation) => total + conversation.unreadCount,
    0,
  );

  return {
    members,
    conversations,
    selectedMembershipId,
    selectedMember,
    messages,
    totalUnreadCount,
  };
}
