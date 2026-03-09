import Link from "next/link";
import { CheckCircle2, ClipboardCheck, MapPinned, ShieldCheck, UsersRound } from "lucide-react";
import { SectionHeader } from "@/components/patterns/section-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { marketingContent } from "@/lib/marketing-content";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  return (
    <div className="space-y-14">
      <section className="grid gap-6 rounded-3xl border bg-surface-strong p-7 shadow-[0_24px_40px_-30px_rgba(26,43,40,0.8)] lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
        <div className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
            {marketingContent.hero.eyebrow}
          </p>
          <h1 className="font-display text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
            {marketingContent.hero.title}
          </h1>
          <p className="max-w-2xl text-lg text-foreground-muted">
            {marketingContent.hero.description}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className={cn(buttonVariants({ size: "lg" }), "text-white")}
              style={{ color: "#fff" }}
            >
              Start your ranch account
            </Link>
            <Link
              href="/pricing"
              className={cn(buttonVariants({ size: "lg", variant: "secondary" }))}
            >
              View pricing
            </Link>
          </div>
        </div>
        <div className="rounded-2xl border bg-background-muted/70 p-5">
          <p className="mb-4 text-sm font-semibold text-foreground">Launch focus</p>
          <ul className="space-y-3 text-sm text-foreground-muted">
            {marketingContent.launchFocus.map((point) => (
              <li key={point} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <SectionHeader
          title="Built for launch operations"
          description="The first release is intentionally focused: keep the ranch team coordinated and accountable."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {marketingContent.featureCards.map((item) => (
            <Card key={item.title} className="bg-surface">
              <CardContent className="space-y-2 py-6">
                <CardTitle>{item.title}</CardTitle>
                <CardDescription className="text-sm">{item.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader
          title="Public to product visual continuity"
          description="The app workspace carries the same tone and structure your team sees here."
        />
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="bg-surface">
            <CardContent className="space-y-3 py-6">
              <ClipboardCheck className="h-5 w-5 text-accent" />
              <CardTitle className="text-base">Work Queue Snapshot</CardTitle>
              <CardDescription>
                Clean status rows with assignment and next-action visibility.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="bg-surface">
            <CardContent className="space-y-3 py-6">
              <UsersRound className="h-5 w-5 text-accent" />
              <CardTitle className="text-base">Crew Coverage Panel</CardTitle>
              <CardDescription>
                Quick checks on active crew, open work, and role-based access.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="bg-surface">
            <CardContent className="space-y-3 py-6">
              <MapPinned className="h-5 w-5 text-accent" />
              <CardTitle className="text-base">Daily Operations View</CardTitle>
              <CardDescription>
                A focused dashboard built for real ranch operating cadence.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 rounded-3xl border bg-surface-strong p-6 md:grid-cols-3">
        <Card className="bg-surface">
          <CardContent className="space-y-2 py-6">
            <UsersRound className="h-5 w-5 text-accent" />
            <CardTitle className="text-base">Tenant-safe architecture</CardTitle>
            <CardDescription>Every ranch workspace is isolated by design.</CardDescription>
          </CardContent>
        </Card>
        <Card className="bg-surface">
          <CardContent className="space-y-2 py-6">
            <ShieldCheck className="h-5 w-5 text-accent" />
            <CardTitle className="text-base">Role-aware controls</CardTitle>
            <CardDescription>Owners, managers, and workers get the right scope.</CardDescription>
          </CardContent>
        </Card>
        <Card className="bg-surface">
          <CardContent className="space-y-2 py-6">
            <MapPinned className="h-5 w-5 text-accent" />
            <CardTitle className="text-base">Grounded workflow design</CardTitle>
            <CardDescription>Clear screens that support real ranch operations.</CardDescription>
          </CardContent>
        </Card>
      </section>

      <section className="rounded-3xl border bg-surface-strong p-6 sm:p-8">
        <SectionHeader
          title="Trust signals for launch"
          description="Clear commitments, clear boundaries, and honest product scope."
        />
        <ul className="grid gap-3 text-sm text-foreground-muted sm:grid-cols-3">
          {marketingContent.trustNotes.map((note) => (
            <li key={note} className="rounded-xl border bg-surface px-4 py-3">
              {note}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
