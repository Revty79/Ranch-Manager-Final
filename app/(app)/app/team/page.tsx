import Link from "next/link";
import { SquarePen, UsersRound } from "lucide-react";
import { AddMemberForm } from "@/components/team/add-member-form";
import { EmptyState } from "@/components/patterns/empty-state";
import { PageHeader } from "@/components/patterns/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/auth/context";
import { getTeamMembersForRanch } from "@/lib/team/queries";
import { cn } from "@/lib/utils";

type TeamFilter = "active" | "inactive" | "all";

function formatPay(payRateCents: number, payType: "hourly" | "salary") {
  const amount = (payRateCents / 100).toFixed(2);
  return payType === "hourly" ? `$${amount} / hr` : `$${amount} / period`;
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const context = await requireRole(["owner", "manager"]);
  const statusParam = (await searchParams).status;
  const activeFilter: TeamFilter =
    statusParam === "inactive" || statusParam === "all" ? statusParam : "active";

  const allMembers = await getTeamMembersForRanch(context.ranch.id, "all");
  const filteredMembers =
    activeFilter === "all"
      ? allMembers
      : allMembers.filter((member) => member.isActive === (activeFilter === "active"));

  const activeCount = allMembers.filter((member) => member.isActive).length;
  const inactiveCount = allMembers.length - activeCount;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Team"
        title="Team Management"
        description="Add crew members, assign roles, and maintain pay setup in the active ranch workspace."
      />

      <Card>
        <CardContent className="space-y-4 py-6">
          <div>
            <CardTitle className="text-base">Add team member</CardTitle>
            <CardDescription>
              Simple launch flow: create a member login and attach them to this ranch.
            </CardDescription>
          </div>
          <AddMemberForm />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2 text-sm">
            {[
              { label: `Active (${activeCount})`, value: "active" as TeamFilter },
              { label: `Inactive (${inactiveCount})`, value: "inactive" as TeamFilter },
              { label: `All (${allMembers.length})`, value: "all" as TeamFilter },
            ].map((filter) => (
              <Link
                key={filter.value}
                href={`/app/team?status=${filter.value}`}
                className={cn(
                  "rounded-full border px-3 py-1.5",
                  activeFilter === filter.value
                    ? "bg-accent text-white"
                    : "bg-surface-strong text-foreground-muted hover:bg-accent-soft",
                )}
              >
                {filter.label}
              </Link>
            ))}
          </div>
          <p className="text-sm text-foreground-muted">{context.ranch.name}</p>
        </div>

        {filteredMembers.length ? (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell>Email</TableHeaderCell>
                  <TableHeaderCell>Role</TableHeaderCell>
                  <TableHeaderCell>Pay</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell className="text-right">Actions</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredMembers.map((member) => (
                  <TableRow key={member.membershipId}>
                    <TableCell>{member.fullName}</TableCell>
                    <TableCell className="text-foreground-muted">{member.email}</TableCell>
                    <TableCell>
                      <Badge variant="neutral">{member.role}</Badge>
                    </TableCell>
                    <TableCell>{formatPay(member.payRateCents, member.payType)}</TableCell>
                    <TableCell>
                      <Badge variant={member.isActive ? "success" : "warning"}>
                        {member.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/app/team/${member.membershipId}`}
                        className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold text-foreground-muted hover:bg-accent-soft hover:text-foreground"
                      >
                        <SquarePen className="h-3.5 w-3.5" />
                        Edit
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <EmptyState
            title="No team members in this filter"
            description="Adjust the filter or add a member to start assigning work."
            icon={<UsersRound className="h-5 w-5 text-accent" />}
          />
        )}
      </section>
    </div>
  );
}
