import Link from "next/link";
import { notFound } from "next/navigation";
import { EditMemberForm } from "@/components/team/edit-member-form";
import { ResetMemberPasswordForm } from "@/components/team/reset-member-password-form";
import { TimeEntryAdjustments } from "@/components/team/time-entry-adjustments";
import { PageHeader } from "@/components/patterns/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/context";
import { getTeamMemberByMembership } from "@/lib/team/queries";
import {
  getRecentShiftsForMembership,
  getRecentWorkSessionsForMembership,
} from "@/lib/time/queries";

function formatRole(role: "owner" | "manager" | "worker" | "seasonal_worker"): string {
  if (role === "worker") return "Regular Worker";
  if (role === "seasonal_worker") return "Seasonal Worker";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export default async function TeamMemberDetailPage({
  params,
}: {
  params: Promise<{ membershipId: string }>;
}) {
  const context = await requireRole(["owner", "manager"]);
  const { membershipId } = await params;
  const [member, recentShifts, recentWorkSessions] = await Promise.all([
    getTeamMemberByMembership(context.ranch.id, membershipId),
    getRecentShiftsForMembership(context.ranch.id, membershipId, 10),
    getRecentWorkSessionsForMembership(context.ranch.id, membershipId, 10),
  ]);

  if (!member) {
    notFound();
  }

  const canResetPassword = !(
    context.membership.role === "manager" && member.role === "owner"
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Team Detail"
        title={member.fullName}
        description="Update member role, pay, and active status."
        actions={
          <Link
            href="/app/team"
            className="rounded-xl border bg-surface px-3 py-2 text-sm font-semibold text-foreground-muted hover:bg-accent-soft hover:text-foreground"
          >
            Back to team
          </Link>
        }
      />

      <Card>
        <CardContent className="space-y-6 py-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={member.isActive ? "success" : "warning"}>
              {member.isActive ? "Active" : "Inactive"}
            </Badge>
            <Badge>{formatRole(member.role)}</Badge>
            <span className="text-sm text-foreground-muted">{member.email}</span>
          </div>
          <EditMemberForm
            membershipId={member.membershipId}
            fullName={member.fullName}
            role={member.role}
            payType={member.payType}
            payRateCents={member.payRateCents}
            payAdvanceCents={member.payAdvanceCents}
            isActive={member.isActive}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 py-6">
          <div>
            <CardTitle className="text-base">Reset login password</CardTitle>
            <CardDescription>
              Set a new temporary password for this member if they cannot sign in. Share it
              securely and they will be forced to set a new password on next login.
            </CardDescription>
          </div>
          <ResetMemberPasswordForm
            membershipId={member.membershipId}
            canReset={canResetPassword}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 py-6">
          <div>
            <CardTitle className="text-base">Clock & hour adjustments</CardTitle>
            <CardDescription>
              Review and correct recent clock-in/clock-out history if this member missed an entry.
            </CardDescription>
          </div>
          <TimeEntryAdjustments
            membershipId={member.membershipId}
            shiftRows={recentShifts.map((shift) => ({
              id: shift.id,
              startedAtIso: shift.startedAt.toISOString(),
              endedAtIso: shift.endedAt ? shift.endedAt.toISOString() : null,
            }))}
            workRows={recentWorkSessions.map((entry) => ({
              id: entry.id,
              workOrderTitle: entry.workOrderTitle,
              startedAtIso: entry.startedAt.toISOString(),
              endedAtIso: entry.endedAt ? entry.endedAt.toISOString() : null,
            }))}
            timeZone={context.user.timeZone}
          />
        </CardContent>
      </Card>
    </div>
  );
}
