import Link from "next/link";
import { Archive, Lock, MessagesSquare } from "lucide-react";
import { CreateMessageForm } from "@/components/communication/create-message-form";
import { ReplyMessageForm } from "@/components/communication/reply-message-form";
import { SendPrivateMessageForm } from "@/components/communication/send-private-message-form";
import { EmptyState } from "@/components/patterns/empty-state";
import { PageHeader } from "@/components/patterns/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { hasSectionAccess } from "@/lib/auth/capabilities";
import { requireSectionAccess } from "@/lib/auth/context";
import { archiveStaleCommunicationForRanch } from "@/lib/communication/maintenance";
import {
  getPrivateMessagingWorkspace,
  getRanchMessageThreads,
  markPrivateConversationAsRead,
  type CommunicationArchiveView,
} from "@/lib/communication/queries";
import type { RanchMessagePriority, RanchRole } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

type CommunicationSearchParams = {
  memberId?: string;
  view?: string;
};

function formatDateTime(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(value);
}

function priorityVariant(priority: RanchMessagePriority) {
  if (priority === "urgent") return "danger";
  return "neutral";
}

function formatRole(role: RanchRole | null): string {
  if (!role) return "former member";
  if (role === "seasonal_worker") return "seasonal worker";
  return role;
}

function resolveAuthorName(author: { fullName: string | null; membershipId: string | null }): string {
  if (author.fullName) return author.fullName;
  if (author.membershipId) return "Unknown member";
  return "Former member";
}

function summarizeMessage(body: string): string {
  if (body.length <= 90) return body;
  return `${body.slice(0, 87)}...`;
}

function resolveArchiveView(
  requestedView: string | undefined,
  canReviewArchive: boolean,
): CommunicationArchiveView {
  if (canReviewArchive && requestedView === "archived") {
    return "archived";
  }
  return "active";
}

export default async function CommunicationPage({
  searchParams,
}: {
  searchParams: Promise<CommunicationSearchParams>;
}) {
  const context = await requireSectionAccess("communication");
  const canManageCommunication = hasSectionAccess(
    context.membership.sectionAccess,
    "communication",
    "manage",
  );
  const canReviewArchive = canManageCommunication;
  const params = await searchParams;
  const archiveView = resolveArchiveView(params.view, canReviewArchive);
  const isArchiveView = archiveView === "archived";
  const requestedMemberId = params.memberId?.trim() ? params.memberId.trim() : null;

  await archiveStaleCommunicationForRanch(context.ranch.id, 30);

  if (!isArchiveView && requestedMemberId) {
    await markPrivateConversationAsRead({
      ranchId: context.ranch.id,
      currentMembershipId: context.membership.id,
      otherMembershipId: requestedMemberId,
    });
  }

  const [threads, privateWorkspace] = await Promise.all([
    getRanchMessageThreads(context.ranch.id, { archiveView }),
    getPrivateMessagingWorkspace({
      ranchId: context.ranch.id,
      currentMembershipId: context.membership.id,
      selectedOtherMembershipId: requestedMemberId,
      archiveView,
    }),
  ]);

  const viewQuery = isArchiveView ? "&view=archived" : "";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Communication"
        title="Ranch Communication"
        description="Post ranch-wide updates and send private one-on-one notes inside your ranch workspace."
        actions={
          canReviewArchive ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href="/app/communication"
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm font-semibold",
                  !isArchiveView
                    ? "bg-accent text-white"
                    : "bg-surface text-foreground-muted hover:bg-accent-soft hover:text-foreground",
                )}
              >
                Active messages
              </Link>
              <Link
                href="/app/communication?view=archived"
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm font-semibold",
                  isArchiveView
                    ? "bg-accent text-white"
                    : "bg-surface text-foreground-muted hover:bg-accent-soft hover:text-foreground",
                )}
              >
                Archived messages
              </Link>
            </div>
          ) : null
        }
      />

      {isArchiveView ? (
        <Card>
          <CardContent className="space-y-2 py-4">
            <div className="flex items-center gap-2">
              <Archive className="h-4 w-4 text-accent" />
              <p className="text-sm font-semibold text-foreground">
                Archive mode (30+ days old)
              </p>
            </div>
            <p className="text-sm text-foreground-muted">
              Archived messages are read-only in this view. They remain retained for legal and incident retrieval.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-4 py-6">
            <div>
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-accent" />
                <CardTitle className="text-base">Private messages</CardTitle>
              </div>
              <CardDescription>
                Use private notes for sensitive requests and respectful coaching.
              </CardDescription>
            </div>
            {canManageCommunication ? (
              <SendPrivateMessageForm
                members={privateWorkspace.members}
                defaultRecipientMembershipId={privateWorkspace.selectedMembershipId}
              />
            ) : (
              <p className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
                You can view communication history, but posting and private messaging are disabled.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardContent className="space-y-4 py-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Private inbox</CardTitle>
                <CardDescription>
                  {isArchiveView
                    ? "Read-only private conversations that have been archived."
                    : "Choose a teammate to open your one-on-one thread."}
                </CardDescription>
              </div>
              <Badge variant={privateWorkspace.totalUnreadCount > 0 ? "warning" : "neutral"}>
                {isArchiveView
                  ? `${privateWorkspace.conversations.length} archived`
                  : `${privateWorkspace.totalUnreadCount} unread`}
              </Badge>
            </div>

            {privateWorkspace.conversations.length ? (
              <ul className="space-y-2">
                {privateWorkspace.conversations.map((conversation) => {
                  const isSelected =
                    conversation.otherMembershipId === privateWorkspace.selectedMembershipId;

                  return (
                    <li key={conversation.otherMembershipId}>
                      <Link
                        href={`/app/communication?memberId=${conversation.otherMembershipId}${viewQuery}`}
                        className={cn(
                          "block rounded-xl border px-3 py-2 transition-colors",
                          isSelected
                            ? "border-accent bg-accent-soft"
                            : "bg-surface hover:bg-surface-strong",
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-foreground">
                            {conversation.otherFullName}
                          </p>
                          <div className="flex items-center gap-2">
                            {!conversation.otherIsActive ? (
                              <Badge variant="warning">Inactive</Badge>
                            ) : null}
                            {!isArchiveView && conversation.unreadCount > 0 ? (
                              <Badge variant="danger">{conversation.unreadCount} new</Badge>
                            ) : null}
                          </div>
                        </div>
                        <p className="text-xs text-foreground-muted">
                          {formatRole(conversation.otherRole)} - {formatDateTime(conversation.latestMessageAt, context.user.timeZone)}
                        </p>
                        <p className="text-sm text-foreground-muted">
                          {conversation.latestDirection === "sent" ? "You: " : ""}
                          {summarizeMessage(conversation.latestMessageBody)}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
                {isArchiveView
                  ? "No archived private messages."
                  : "No private messages yet."}
              </p>
            )}

            {privateWorkspace.selectedMembershipId ? (
              <Link
                href={isArchiveView ? "/app/communication?view=archived" : "/app/communication"}
                className="inline-flex rounded-lg border bg-surface px-2.5 py-1 text-xs font-semibold text-foreground-muted hover:bg-accent-soft hover:text-foreground"
              >
                Clear selection
              </Link>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 py-6">
            {privateWorkspace.selectedMember ? (
              <>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">{privateWorkspace.selectedMember.fullName}</CardTitle>
                    <Badge variant="neutral">{formatRole(privateWorkspace.selectedMember.role)}</Badge>
                    {!privateWorkspace.selectedMember.isActive ? (
                      <Badge variant="warning">Inactive</Badge>
                    ) : null}
                  </div>
                  <CardDescription>
                    {isArchiveView
                      ? "Archived private history with this teammate."
                      : "Private one-on-one history with this teammate."}
                  </CardDescription>
                </div>

                {privateWorkspace.messages.length ? (
                  <ul className="max-h-[460px] space-y-2 overflow-y-auto pr-1">
                    {privateWorkspace.messages.map((message) => {
                      const isSentByCurrent =
                        message.senderMembershipId === context.membership.id;

                      return (
                        <li
                          key={message.id}
                          className={cn(
                            "flex",
                            isSentByCurrent ? "justify-end" : "justify-start",
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[85%] rounded-xl border px-3 py-2 text-sm",
                              isSentByCurrent
                                ? "border-accent bg-accent text-white"
                                : "border-border bg-surface",
                            )}
                          >
                            <p className="whitespace-pre-wrap">{message.body}</p>
                            <p
                              className={cn(
                                "mt-1 text-[11px]",
                                isSentByCurrent ? "text-white/85" : "text-foreground-muted",
                              )}
                            >
                              {formatDateTime(message.createdAt, context.user.timeZone)}
                              {isArchiveView
                                ? " - archived"
                                : isSentByCurrent
                                  ? message.isRead
                                    ? " - read"
                                    : " - sent"
                                  : ""}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
                    No private messages yet in this thread.
                  </p>
                )}
              </>
            ) : (
              <>
                <CardTitle className="text-base">Private conversation</CardTitle>
                <CardDescription>
                  Open a teammate thread from the inbox to view private history.
                </CardDescription>
                <p className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
                  Select a teammate from the private inbox.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {!isArchiveView && canManageCommunication ? (
        <Card>
          <CardContent className="space-y-4 py-6">
            <div>
              <CardTitle className="text-base">Start a ranch thread</CardTitle>
              <CardDescription>
                Messages stay scoped to this ranch, with urgent tagging when something needs immediate attention.
              </CardDescription>
            </div>
            <CreateMessageForm />
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">
            {isArchiveView ? "Archived team threads" : "Team threads"}
          </h2>
          <p className="text-sm text-foreground-muted">
            {isArchiveView
              ? "Read-only ranch thread history that has been archived after 30 days of inactivity."
              : "Keep operations context in one timeline so owners, managers, and workers stay aligned."}
          </p>
        </div>

        {threads.length ? (
          <div className="space-y-4">
            {threads.map((thread) => (
              <Card key={thread.id}>
                <CardContent className="space-y-4 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">{thread.title ?? "Untitled thread"}</CardTitle>
                        <Badge variant={priorityVariant(thread.priority)}>
                          {thread.priority === "urgent" ? "Urgent" : "Normal"}
                        </Badge>
                        <Badge variant="neutral">{thread.replyCount} replies</Badge>
                      </div>
                      <p className="text-xs text-foreground-muted">
                        Posted by {resolveAuthorName(thread.author)} ({formatRole(thread.author.role)}) on{" "}
                        {formatDateTime(thread.createdAt, context.user.timeZone)}
                      </p>
                      <p className="text-xs text-foreground-muted">
                        Last activity {formatDateTime(thread.latestActivityAt, context.user.timeZone)}
                      </p>
                    </div>
                  </div>

                  <p className="whitespace-pre-wrap text-sm text-foreground">{thread.body}</p>

                  <div className="space-y-2 rounded-xl border bg-surface p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground-muted">
                      Replies
                    </p>
                    {thread.replies.length ? (
                      <ul className="space-y-2">
                        {thread.replies.map((reply) => (
                          <li key={reply.id} className="rounded-lg border bg-surface-strong px-3 py-2">
                            <p className="whitespace-pre-wrap text-sm text-foreground">{reply.body}</p>
                            <p className="mt-1 text-xs text-foreground-muted">
                              {resolveAuthorName(reply.author)} ({formatRole(reply.author.role)}) on{" "}
                              {formatDateTime(reply.createdAt, context.user.timeZone)}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-foreground-muted">No replies yet.</p>
                    )}
                  </div>

                  {!isArchiveView && canManageCommunication ? (
                    <ReplyMessageForm parentMessageId={thread.id} />
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title={isArchiveView ? "No archived threads yet" : "No communication threads yet"}
            description={
              isArchiveView
                ? "Archived threads appear here once active threads age past the retention window."
                : "Post the first message to start ranch-wide coordination in this workspace."
            }
            icon={<MessagesSquare className="h-5 w-5 text-accent" />}
          />
        )}
      </section>
    </div>
  );
}
