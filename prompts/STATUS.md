# Codex Prompt Queue Status — Ranch Manager Final (Clean Rebuild)

## How this works
- Codex reads this file to find the next unchecked prompt.
- After completing a prompt, Codex checks it off and fills in the matching Run Log section.
- This file is the source of truth for progress.

## Queue
- [x] 00_foundation_scaffold.md
- [x] 01_auth_tenancy_onboarding.md
- [x] 02_public_marketing_access.md
- [x] 03_team_management.md
- [x] 04_work_orders.md
- [x] 05_time_tracking.md
- [x] 06_payroll.md
- [x] 07_billing_stripe.md
- [x] 08_launch_polish_deploy.md

---

## Run Log (Codex fills this in)

### 00_foundation_scaffold.md
Status: DONE
Summary:
- Scaffolded a Next.js App Router + TypeScript + Tailwind codebase at repo root with production-oriented folders.
- Built polished public, auth, and internal app shell layouts with a cohesive ranch-business visual system.
- Added placeholder routes for all required pages: marketing, auth, and `/app/*` sections.
- Added shared UI primitives/pattern components: headers, stat cards, empty/loading/error states, table/form shells, confirmation shell, and access-state shells.
- Added PostgreSQL-ready Drizzle baseline (`lib/db`, `drizzle.config.ts`) and generated initial migration.
- Added env baseline, local architecture docs, and README run/check/database command guidance.
Files changed:
- package.json
- app/layout.tsx
- app/globals.css
- app/(public)/layout.tsx
- app/(public)/page.tsx
- app/(public)/pricing/page.tsx
- app/(auth)/layout.tsx
- app/(auth)/login/page.tsx
- app/(auth)/signup/page.tsx
- app/(app)/app/layout.tsx
- app/(app)/app/page.tsx
- app/(app)/app/team/page.tsx
- app/(app)/app/work-orders/page.tsx
- app/(app)/app/time/page.tsx
- app/(app)/app/payroll/page.tsx
- app/(app)/app/settings/page.tsx
- app/(app)/app/loading.tsx
- app/(app)/app/error.tsx
- app/not-found.tsx
- components/layout/*
- components/patterns/*
- components/ui/*
- lib/utils.ts
- lib/site-config.ts
- lib/db/client.ts
- lib/db/schema.ts
- drizzle.config.ts
- drizzle/*
- .env.example
- README.md
- docs/architecture.md
Commands to run:
- npm install
- npm run db:generate
- npm run lint
- npm run typecheck
- npm run build
- npm run dev
How to verify:
- 1) Start app: `npm run dev`
- 2) Open `http://localhost:3000` and confirm branded landing page sections and CTA buttons.
- 3) Open `/pricing`, `/login`, and `/signup` and confirm styled page shells/forms.
- 4) Open `/app`, `/app/team`, `/app/work-orders`, `/app/time`, `/app/payroll`, `/app/settings` and confirm app shell + placeholder states render.
- 5) Run `npm run lint`, `npm run typecheck`, and `npm run build` and confirm all pass.

### 01_auth_tenancy_onboarding.md
Status: DONE
Summary:
- Implemented secure email/password auth with bcrypt hashing, HMAC-backed session token cookies, login/logout flows, and server actions.
- Added onboarding flow at `/onboarding` where the first authenticated user creates a ranch and is assigned `owner`.
- Added server-side tenant context helpers for current user, current ranch, and current membership.
- Added baseline role guards with route protection and friendly access-denied surface (`/app/access-denied`).
- App entry flow now routes unauthenticated users to `/login`, incomplete onboarding to `/onboarding`, and completed accounts to `/app`.
- Settings page now shows live ranch name, current user identity, and current role from server context.
Files changed:
- lib/db/schema.ts
- lib/auth/session.ts
- lib/auth/password.ts
- lib/auth/context.ts
- lib/auth/actions.ts
- components/auth/*
- app/(auth)/login/page.tsx
- app/(auth)/signup/page.tsx
- app/(auth)/onboarding/page.tsx
- app/(app)/app/layout.tsx
- app/(app)/app/team/page.tsx
- app/(app)/app/payroll/page.tsx
- app/(app)/app/settings/page.tsx
- app/(app)/app/access-denied/page.tsx
- components/layout/app-shell.tsx
- components/layout/app-sidebar.tsx
- components/layout/app-topbar.tsx
- docs/auth-tenancy.md
- drizzle/0001_nostalgic_purifiers.sql
- drizzle/meta/*
Commands to run:
- npm run db:generate
- npm run lint
- npm run typecheck
- npm run build
- npm run dev
How to verify:
- 1) Start app: `npm run dev`
- 2) Open `/app` while logged out and confirm redirect to `/login`.
- 3) Create account at `/signup`; confirm redirect to `/onboarding`.
- 4) Submit ranch name on `/onboarding`; confirm redirect to `/app` and app shell shows ranch/user/role context.
- 5) Open `/app/team` and `/app/payroll` with owner account and confirm access is allowed.
- 6) Use top-bar `Log out`; confirm redirect to `/login`.
- 7) Run `npm run lint`, `npm run typecheck`, and `npm run build` and confirm pass.

### 02_public_marketing_access.md
Status: DONE
Summary:
- Refined landing and pricing pages with clearer launch messaging, trust framing, and stronger conversion-oriented layout.
- Centralized marketing copy into `lib/marketing-content.ts` for easier future edits.
- Added public access-state pages/components for billing required, no ranch access, insufficient role, and onboarding incomplete.
- Improved auth screen polish with a branded side panel to visually bridge marketing and product experience.
- Added explicit route previews in settings for demo-ready access-state navigation.
Files changed:
- lib/marketing-content.ts
- lib/site-config.ts
- app/(public)/page.tsx
- app/(public)/pricing/page.tsx
- app/(public)/billing-required/page.tsx
- app/(public)/no-ranch-access/page.tsx
- app/(public)/onboarding-incomplete/page.tsx
- app/(auth)/layout.tsx
- components/patterns/access-states.tsx
- app/(app)/app/settings/page.tsx
Commands to run:
- npm run lint
- npm run typecheck
- npm run build
- npm run dev
How to verify:
- 1) Start app: `npm run dev`
- 2) Open `/` and confirm polished hero, launch capability cards, product bridge section, and trust section.
- 3) Open `/pricing` and confirm clear single-plan presentation, included/not-included lists, and signup CTA.
- 4) Open `/login` and `/signup` and confirm branded auth layout with validation-ready forms.
- 5) Open `/billing-required`, `/no-ranch-access`, `/onboarding-incomplete`, and `/app/access-denied` and confirm humane branded access states.
- 6) Run `npm run lint`, `npm run typecheck`, and `npm run build` and confirm pass.

### 03_team_management.md
Status: DONE
Summary:
- Added team-management data fields on memberships (`pay_type`, `pay_rate_cents`, active/deactivated timestamps) with migration.
- Implemented server-side team actions for add member, edit member, role assignment, pay updates, and activate/deactivate.
- Enforced tenant boundaries and role checks (`owner`/`manager` only), including manager restrictions around owner memberships.
- Built production-style Team page with add-member flow, active/inactive/all filters, member table, and empty states.
- Added dedicated member detail/edit route (`/app/team/[membershipId]`) with update and status controls.
Files changed:
- lib/db/schema.ts
- lib/team/actions.ts
- lib/team/queries.ts
- components/team/add-member-form.tsx
- components/team/edit-member-form.tsx
- app/(app)/app/team/page.tsx
- app/(app)/app/team/[membershipId]/page.tsx
- drizzle/0002_fine_mongoose.sql
- drizzle/meta/*
Commands to run:
- npm run db:generate
- npm run lint
- npm run typecheck
- npm run build
- npm run dev
How to verify:
- 1) Start app: `npm run dev`, log in as owner or manager.
- 2) Open `/app/team` and add a member with name/email/role/pay settings.
- 3) Confirm member appears in table with role, pay info, and active badge.
- 4) Click `Edit` to open `/app/team/[membershipId]`, update role/pay/name, and save.
- 5) Deactivate then reactivate the member from detail page; confirm status changes.
- 6) Use filter pills on `/app/team` (active/inactive/all) and confirm list updates.
- 7) Run `npm run lint`, `npm run typecheck`, and `npm run build` and confirm pass.

### 04_work_orders.md
Status: DONE
Summary:
- Added launch work-order schema with statuses, priorities, due dates, creator linkage, and assignment join table.
- Implemented server-side manager/owner actions to create, edit, assign, and update work orders with tenant scoping.
- Built manager-facing `/app/work-orders` list flow with status tabs, search, create form, assignment UI, and edit links.
- Added detailed edit route `/app/work-orders/[workOrderId]` for status/assignment/detail updates.
- Implemented worker-facing assigned-work view on `/app/work-orders` with manager-only controls hidden.
Files changed:
- lib/db/schema.ts
- lib/work-orders/actions.ts
- lib/work-orders/queries.ts
- components/work-orders/create-work-order-form.tsx
- components/work-orders/edit-work-order-form.tsx
- app/(app)/app/work-orders/page.tsx
- app/(app)/app/work-orders/[workOrderId]/page.tsx
- drizzle/0003_shallow_tarantula.sql
- drizzle/meta/*
Commands to run:
- npm run db:generate
- npm run lint
- npm run typecheck
- npm run build
- npm run dev
How to verify:
- 1) Start app and log in as owner/manager.
- 2) Open `/app/work-orders`, create a work order, assign members, and set status/priority.
- 3) Confirm the work order appears in the list with status badge, assignees, due date, and edit action.
- 4) Open `/app/work-orders/[workOrderId]`, update fields/assignees/status, and save.
- 5) Log in as a worker and open `/app/work-orders`; confirm only assigned-work view is shown without manager create/edit clutter.
- 6) Run `npm run lint`, `npm run typecheck`, and `npm run build` and confirm pass.

### 05_time_tracking.md
Status: DONE
Summary:
- Added shift and work-time schema tables with ranch/member/work-order linkage and migration support.
- Implemented server-side time actions: start/end shift, start/stop work timer, with transition guardrails.
- Enforced key state rules: no duplicate active shifts, no duplicate active work timers, shift required before task timer, worker assignment checks.
- Built a focused `/app/time` experience with current state cards, start/stop controls, shift/work history tables, and empty states.
- Added manager/owner visibility into currently active team shifts and active work context.
Files changed:
- lib/db/schema.ts
- lib/time/queries.ts
- lib/time/actions.ts
- components/time/time-control-panel.tsx
- app/(app)/app/time/page.tsx
- drizzle/0004_striped_lionheart.sql
- drizzle/meta/*
Commands to run:
- npm run db:generate
- npm run lint
- npm run typecheck
- npm run build
- npm run dev
How to verify:
- 1) Start app and open `/app/time`.
- 2) Click `Start shift`; confirm active shift state appears.
- 3) Start a work timer on an available work order; confirm active work state appears.
- 4) Attempt starting another work timer while one is active; confirm guardrail error.
- 5) Stop work timer, then end shift; confirm entries appear in shift/work history tables.
- 6) As manager/owner, confirm team active shift panel appears with live roster information.
- 7) Run `npm run lint`, `npm run typecheck`, and `npm run build` and confirm pass.

### 06_payroll.md
Status: DONE
Summary:
- Built owner/manager payroll summary page with selectable date range and transparent calculation messaging.
- Implemented server-side payroll aggregation from tracked shift hours with per-member totals, pay type/rate, and estimated pay.
- Added payroll summary cards for total members, hours, and estimated pay in the selected period.
- Implemented CSV export route (`/app/payroll/export`) with sensible filenames and output matching visible summary rows.
- Added payroll utility modules for date-range resolution and CSV construction.
Files changed:
- app/(app)/app/payroll/page.tsx
- app/(app)/app/payroll/export/route.ts
- lib/payroll/date-range.ts
- lib/payroll/queries.ts
- lib/payroll/csv.ts
Commands to run:
- npm run lint
- npm run typecheck
- npm run build
- npm run dev
How to verify:
- 1) Log in as owner/manager and open `/app/payroll`.
- 2) Adjust `from` / `to` range and apply; confirm table and summary cards refresh.
- 3) Confirm rows show member identity, role, pay type/rate, hours, and estimated pay.
- 4) Click `Export CSV`; confirm a CSV download starts with matching visible row data.
- 5) Run `npm run lint`, `npm run typecheck`, and `npm run build` and confirm pass.

### 07_billing_stripe.md
Status: DONE
Summary:
- Extended ranch billing schema with Stripe customer/subscription IDs and subscription period tracking.
- Implemented Stripe checkout server action for owners and public `/checkout` entry path from pricing CTA.
- Implemented Stripe webhook sync route (`/api/stripe/webhook`) for checkout and subscription lifecycle events.
- Added durable internal access model support via `beta_lifetime_access` and owner beta-code claim flow.
- Added paid-access gating helper and enforced gating on core app routes, redirecting unpaid users to `/app/billing-required`.
- Upgraded settings to owner-facing billing surface with current access state, plan/status visibility, checkout action, and beta-lifetime controls.
Files changed:
- lib/db/schema.ts
- lib/auth/context.ts
- lib/billing/access.ts
- lib/billing/stripe.ts
- lib/billing/actions.ts
- components/billing/checkout-form.tsx
- components/billing/beta-code-form.tsx
- app/(public)/pricing/page.tsx
- app/(public)/checkout/page.tsx
- app/(app)/app/billing-required/page.tsx
- app/(app)/app/settings/page.tsx
- app/(app)/app/page.tsx
- app/(app)/app/work-orders/page.tsx
- app/(app)/app/time/page.tsx
- app/api/stripe/webhook/route.ts
- app/(app)/app/payroll/export/route.ts
- .env.example
- docs/billing.md
- drizzle/0005_magical_bastion.sql
- drizzle/meta/*
Commands to run:
- npm install
- npm run db:generate
- npm run lint
- npm run typecheck
- npm run build
- npm run dev
How to verify:
- 1) Set Stripe env vars (`STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `APP_URL`) and start app.
- 2) Open `/pricing` then `Start paid checkout`; confirm routing into `/checkout` and checkout launch for owner context.
- 3) Complete/cancel checkout and confirm return to `/app/settings?billing=success|cancel`.
- 4) Send Stripe webhook events to `/api/stripe/webhook`; confirm ranch subscription fields/status update.
- 5) Validate paid gating: unpaid non-beta account visiting `/app` redirects to `/app/billing-required`.
- 6) Apply configured beta lifetime code in settings and confirm access remains enabled without active subscription.
- 7) Run `npm run lint`, `npm run typecheck`, and `npm run build` and confirm pass.

### 08_launch_polish_deploy.md
Status: DONE
Summary:
- Added launch-polish loading coverage for core app areas (team, work orders, time, payroll, settings) plus already-available empty/error/access states.
- Improved billing/account surface with clearer success/cancel messaging, access status visibility, and owner-only billing controls.
- Added safe demo seeding path (`npm run seed:demo`) with explicit non-production guardrails and reusable demo credentials.
- Expanded documentation for deployment and operations (`README`, Render notes, billing notes, demo walkthrough script).
- Verified end-to-end build quality after polish (`lint`, `typecheck`, `build`) with all checks passing.
Files changed:
- package.json
- app/(app)/app/team/loading.tsx
- app/(app)/app/work-orders/loading.tsx
- app/(app)/app/time/loading.tsx
- app/(app)/app/payroll/loading.tsx
- app/(app)/app/settings/loading.tsx
- scripts/seed-demo.ts
- README.md
- docs/deploy-render.md
- docs/demo-walkthrough.md
- docs/billing.md
- app/(app)/app/settings/page.tsx
- app/(public)/checkout/page.tsx
- app/(app)/app/billing-required/page.tsx
- app/api/stripe/webhook/route.ts
- app/(app)/app/payroll/export/route.ts
- lib/billing/*
- lib/auth/context.ts
- lib/db/schema.ts
- drizzle/0005_magical_bastion.sql
- drizzle/meta/*
Commands to run:
- npm install
- npm run db:migrate
- npm run lint
- npm run typecheck
- npm run build
- npm run dev
- ALLOW_DEMO_SEED=true npm run seed:demo
How to verify:
- 1) Open `/`, `/pricing`, `/signup`, complete onboarding, and reach `/app`.
- 2) If unpaid/non-beta, confirm protected routes redirect to `/app/billing-required`; use `/app/settings` to start checkout or apply beta code.
- 3) Add team members at `/app/team`, create/assign work orders at `/app/work-orders`, and track time at `/app/time`.
- 4) Open `/app/payroll`, select date range, verify totals/table, and export CSV.
- 5) Optionally run demo seed (`ALLOW_DEMO_SEED=true npm run seed:demo`) and follow `docs/demo-walkthrough.md`.
- 6) Confirm deploy docs/readme steps are present (`README.md`, `docs/deploy-render.md`, `docs/billing.md`).
- 7) Run `npm run lint`, `npm run typecheck`, and `npm run build` and confirm pass.
