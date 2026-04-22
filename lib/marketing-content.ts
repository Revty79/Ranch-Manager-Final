export const marketingContent = {
  hero: {
    eyebrow: "Ranch Operations Platform",
    title: "Know who is working, what got done, and what payroll is owed.",
    description:
      "Ranch Manager gives ranch owners one grounded operating system for crew execution, payroll visibility, herd records, and land movement without piecing together separate apps.",
  },
  buyerOutcomes: [
    {
      title: "Who is working right now",
      description:
        "Live shift and work-timer visibility shows active crew coverage before the day gets away from you.",
    },
    {
      title: "What got done and what is stuck",
      description:
        "Work-order status and manager review flow keep completed work accountable and unresolved work visible.",
    },
    {
      title: "What payroll is owed this period",
      description:
        "Time-driven payroll summaries, period controls, and exports remove guesswork before payday.",
    },
    {
      title: "Where herd and land stand today",
      description:
        "Animal lifecycle, occupancy, movement, and grazing signals stay in one shared ranch context.",
    },
  ],
  launchFocus: [
    "Daily dashboard with crew, work, payroll, herd, and land signals in one view",
    "Role-aware team workflows for owners, managers, and workers",
    "Structured work-order completion and manager review handoff",
    "Payroll period controls with advances, carryover, and CSV exports",
    "Unified cattle and horse registry with movement-linked land occupancy",
    "Grazing move alerts and rest planning tied to real unit activity",
  ],
  workflowStory: [
    {
      title: "Start the day with one dashboard",
      route: "/app",
      description:
        "See active crew, open work, due herd protocols, and grazing move alerts in one snapshot.",
    },
    {
      title: "Assign work and track execution",
      route: "/app/work-orders",
      description:
        "Create and assign work orders, then track shift and task timers as work moves from open to complete.",
    },
    {
      title: "Review completion with context",
      route: "/app/work-orders/[workOrderId]",
      description:
        "Managers verify completed work before approval so payroll-impacting completion stays trusted.",
    },
    {
      title: "Finalize payroll with confidence",
      route: "/app/payroll",
      description:
        "Review totals, period ledger state, advances, and check pickup status before export.",
    },
    {
      title: "Keep herd and land aligned",
      route: "/app/herd and /app/land",
      description:
        "Track lifecycle and protocol due items while land occupancy and movement history stay synchronized.",
    },
  ],
  trustNotes: [
    "Multi-tenant ranch boundary protection",
    "Server-owned authorization and sensitive rules",
    "Practical launch scope without over-promised modules",
  ],
  featureCards: [
    {
      title: "Crew Management",
      description: "Keep your ranch team organized with role and pay visibility.",
    },
    {
      title: "Work Orders",
      description: "Create, assign, and track work with status clarity every day.",
    },
    {
      title: "Time Tracking",
      description: "Track shifts and task time with practical, dependable guardrails.",
    },
    {
      title: "Payroll Summary",
      description: "Review and export payroll-ready summaries for your selected period.",
    },
    {
      title: "Herd Registry",
      description: "Track cattle and horses in one practical lifecycle-ready registry.",
    },
    {
      title: "Land Units",
      description: "Organize pasture, lot, corral, pen, and stall spaces in one shared model.",
    },
    {
      title: "Ranch Communication",
      description: "Keep owners, managers, and workers aligned with ranch-scoped message threads.",
    },
  ],
  pricing: {
    planName: "Bundled Base Plan",
    amount: "$19.99/mo or $199/yr",
    cadence: "per ranch",
    description:
      "One subscription unlocks the full base ranch operations package with no separate herd or land add-on required, billed monthly or annually.",
    confidenceNotes: [
      "Single plan includes crew, work, time, payroll, herd, and land",
      "No hidden per-user pricing in this launch phase",
      "Use demo ranch first, then start your own account when ready",
    ],
    included: [
      "Team management with role and pay setup",
      "Work-order creation, assignment, and status tracking",
      "Shift and work-order time tracking",
      "Payroll summary and CSV export workflow",
      "Herd management foundation (cattle and horses in one model)",
      "Land management foundation (pastures, lots, corrals, pens, stalls)",
      "Animal event and location history foundation",
      "Internal ranch communication threads and private messages",
      "Owner-managed billing access controls",
    ],
  },
};
