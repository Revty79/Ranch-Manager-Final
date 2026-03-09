import Link from "next/link";
import { notFound } from "next/navigation";
import { EditMemberForm } from "@/components/team/edit-member-form";
import { PageHeader } from "@/components/patterns/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/context";
import { getTeamMemberByMembership } from "@/lib/team/queries";

export default async function TeamMemberDetailPage({
  params,
}: {
  params: Promise<{ membershipId: string }>;
}) {
  const context = await requireRole(["owner", "manager"]);
  const { membershipId } = await params;
  const member = await getTeamMemberByMembership(context.ranch.id, membershipId);

  if (!member) {
    notFound();
  }

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
            <Badge>{member.role}</Badge>
            <span className="text-sm text-foreground-muted">{member.email}</span>
          </div>
          <EditMemberForm
            membershipId={member.membershipId}
            fullName={member.fullName}
            role={member.role}
            payType={member.payType}
            payRateCents={member.payRateCents}
            isActive={member.isActive}
          />
        </CardContent>
      </Card>
    </div>
  );
}
