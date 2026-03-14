import Link from "next/link";
import { CalendarHeart, ShieldCheck } from "lucide-react";
import { ProtocolTemplateForm } from "@/components/herd/protocol-template-form";
import { ToggleProtocolTemplateForm } from "@/components/herd/toggle-protocol-template-form";
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
import { roleCanManageOperations, requirePaidAccessContext } from "@/lib/auth/context";
import { formatAnimalEventType, formatAnimalSpecies } from "@/lib/herd/constants";
import {
  getProtocolDueItemsForRanch,
  getProtocolTemplatesForRanch,
  getRecentBreedingActivity,
  getRecentHealthActivity,
} from "@/lib/herd/protocol-queries";

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function dueVariant(dueState: string) {
  if (dueState === "overdue") return "danger";
  if (dueState === "due_soon") return "warning";
  return "neutral";
}

function dueLabel(daysUntil: number): string {
  if (daysUntil < 0) return `${Math.abs(daysUntil)}d overdue`;
  if (daysUntil === 0) return "due today";
  return `due in ${daysUntil}d`;
}

function animalLabel(tagId: string, displayName: string | null): string {
  return displayName ? `${displayName} (${tagId})` : tagId;
}

export default async function HerdBreedingPage() {
  const context = await requirePaidAccessContext();
  const canManage = roleCanManageOperations(context.membership.role);

  const [dueItems, templates, recentBreeding, recentHealth] = await Promise.all([
    getProtocolDueItemsForRanch(context.ranch.id, { limit: 60 }),
    getProtocolTemplatesForRanch(context.ranch.id),
    getRecentBreedingActivity(context.ranch.id),
    getRecentHealthActivity(context.ranch.id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Herd"
        title="Breeding & Health Protocols"
        description="Ranch-configurable reminders and structured activity tracking for breeding and herd health workflows."
      />

      <Card className="border-accent/35">
        <CardContent className="space-y-2 py-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-accent" />
            <CardTitle className="text-base">Configurable reminder framing</CardTitle>
          </div>
          <CardDescription>
            Protocol templates are operational reminders only. Adjust intervals and due thresholds
            to match ranch management plans and veterinary guidance.
          </CardDescription>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardContent className="space-y-4 py-6">
            <div className="flex items-center gap-2">
              <CalendarHeart className="h-4 w-4 text-accent" />
              <CardTitle className="text-base">Due soon / overdue</CardTitle>
            </div>
            {dueItems.length ? (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Animal</TableHeaderCell>
                      <TableHeaderCell>Protocol</TableHeaderCell>
                      <TableHeaderCell>Last event</TableHeaderCell>
                      <TableHeaderCell>Due date</TableHeaderCell>
                      <TableHeaderCell>Status</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dueItems.map((item) => (
                      <TableRow key={`${item.protocolId}-${item.animalId}`}>
                        <TableCell>
                          <Link
                            href={`/app/herd/${item.animalId}`}
                            className="font-semibold text-accent hover:underline"
                          >
                            {animalLabel(item.animalTagId, item.animalDisplayName)}
                          </Link>
                        </TableCell>
                        <TableCell>{item.protocolName}</TableCell>
                        <TableCell>
                          {item.lastEventAt ? formatDateTime(item.lastEventAt) : "No matching record yet"}
                        </TableCell>
                        <TableCell>{formatDateTime(item.dueAt)}</TableCell>
                        <TableCell>
                          <Badge variant={dueVariant(item.dueState)}>{dueLabel(item.daysUntilDue)}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <EmptyState
                title="No due items yet"
                description="Create at least one active protocol template to generate due tracking."
                icon={<CalendarHeart className="h-5 w-5 text-accent" />}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 py-6">
            <CardTitle className="text-base">Protocol templates</CardTitle>
            <CardDescription>
              Define ranch-level interval reminders. No fixed national schedule is hardcoded.
            </CardDescription>
            {canManage ? (
              <ProtocolTemplateForm />
            ) : (
              <p className="rounded-xl border bg-surface px-4 py-3 text-sm text-foreground-muted">
                Owners and managers can configure templates. Your role is{" "}
                <span className="font-semibold text-foreground">{context.membership.role}</span>.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardContent className="space-y-4 py-6">
          <CardTitle className="text-base">Current templates</CardTitle>
          {templates.length ? (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Name</TableHeaderCell>
                    <TableHeaderCell>Type</TableHeaderCell>
                    <TableHeaderCell>Scope</TableHeaderCell>
                    <TableHeaderCell>Interval</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell className="text-right">Actions</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell>{template.name}</TableCell>
                      <TableCell>{template.protocolType.replace("_", " ")}</TableCell>
                      <TableCell>
                        {(template.species ? formatAnimalSpecies(template.species) : "all species") +
                          " / " +
                          (template.sex ?? "all sex values")}
                      </TableCell>
                      <TableCell>
                        every {template.intervalDays}d (due soon: {template.dueSoonDays}d)
                      </TableCell>
                      <TableCell>
                        <Badge variant={template.isActive ? "success" : "neutral"}>
                          {template.isActive ? "active" : "paused"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {canManage ? (
                          <ToggleProtocolTemplateForm
                            templateId={template.id}
                            isActive={template.isActive}
                          />
                        ) : (
                          <span className="text-xs text-foreground-muted">View only</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <EmptyState
              title="No templates yet"
              description="Create your first protocol template to activate due tracking."
              icon={<ShieldCheck className="h-5 w-5 text-accent" />}
            />
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 py-6">
            <CardTitle className="text-base">Recent breeding activity</CardTitle>
            {recentBreeding.length ? (
              <ul className="space-y-2 text-sm text-foreground-muted">
                {recentBreeding.map((entry) => (
                  <li key={entry.id} className="rounded-lg border bg-surface px-3 py-2">
                    <Link href={`/app/herd/${entry.animalId}`} className="font-semibold text-accent hover:underline">
                      {animalLabel(entry.animalTagId, entry.animalDisplayName)}
                    </Link>
                    <span className="text-foreground-muted"> · {formatDateTime(entry.occurredAt)}</span>
                    <p>{entry.summary}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-foreground-muted">No breeding records yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 py-6">
            <CardTitle className="text-base">Recent health activity</CardTitle>
            {recentHealth.length ? (
              <ul className="space-y-2 text-sm text-foreground-muted">
                {recentHealth.map((entry) => (
                  <li key={entry.id} className="rounded-lg border bg-surface px-3 py-2">
                    <Link href={`/app/herd/${entry.animalId}`} className="font-semibold text-accent hover:underline">
                      {animalLabel(entry.animalTagId, entry.animalDisplayName)}
                    </Link>
                    <span className="text-foreground-muted"> · {formatDateTime(entry.occurredAt)}</span>
                    <p>
                      {formatAnimalEventType(entry.eventType)}: {entry.summary}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-foreground-muted">No health records yet.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
