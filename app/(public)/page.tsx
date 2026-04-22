import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
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
              Start account
            </Link>
            <Link
              href="/demo"
              className={cn(buttonVariants({ size: "lg", variant: "secondary" }))}
            >
              View demo ranch
            </Link>
            <Link
              href="/pricing"
              className={cn(buttonVariants({ size: "lg", variant: "ghost" }))}
            >
              View pricing
            </Link>
          </div>
        </div>
        <div className="rounded-2xl border bg-background-muted/70 p-5">
          <p className="mb-4 text-sm font-semibold text-foreground">What this replaces</p>
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
          title="Owner Outcomes"
          description="Specific outcomes ranch owners can verify in daily use."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {marketingContent.buyerOutcomes.map((item) => (
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
          title="How A Ranch Uses It"
          description="Real workflow sequence built from live routes in the current product."
        />
        <div className="grid gap-4 lg:grid-cols-2">
          {marketingContent.workflowStory.map((step) => (
            <Card key={step.title} className="bg-surface">
              <CardContent className="space-y-2 py-6">
                <CardTitle className="text-base">{step.title}</CardTitle>
                <CardDescription>{step.description}</CardDescription>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground-muted">
                  Route: {step.route}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader
          title="Included In Launch"
          description="Capabilities currently shipped in the bundled base plan."
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

      <section className="rounded-3xl border bg-surface-strong p-6 sm:p-8">
        <SectionHeader
          title="Trust Signals For Launch"
          description="Clear commitments, clear boundaries, and honest shipped scope."
        />
        <ul className="grid gap-3 text-sm text-foreground-muted sm:grid-cols-3">
          {marketingContent.trustNotes.map((note) => (
            <li key={note} className="rounded-xl border bg-surface px-4 py-3">
              {note}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl border bg-surface-strong p-6 sm:p-8">
        <SectionHeader
          title="See It Two Ways"
          description="Start your own ranch workspace, or explore realistic seeded operations first."
        />
        <div className="flex flex-wrap gap-3">
          <Link
            href="/signup"
            className={cn(buttonVariants({ size: "lg" }), "text-white")}
            style={{ color: "#fff" }}
          >
            Start account
          </Link>
          <Link
            href="/demo"
            className={cn(buttonVariants({ size: "lg", variant: "secondary" }))}
          >
            View demo ranch
          </Link>
          <Link href="/pricing" className={cn(buttonVariants({ size: "lg", variant: "ghost" }))}>
            Review pricing
          </Link>
        </div>
      </section>
    </div>
  );
}
