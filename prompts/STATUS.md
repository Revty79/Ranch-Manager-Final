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
- [x] 09_post_auth_redirects_to_activation.md
- [x] 10_billing_required_activation_hub.md
- [x] 11_trial_support_and_checkout_cleanup.md
- [x] 12_settings_customer_portal_and_cancel.md
- [x] 13_launch_flow_qa.md
- [x] 14_herd_land_package_foundation.md
- [x] 15_animal_registry_and_lifecycle.md
- [x] 16_land_units_movements_corrals_and_horses.md
- [x] 17_breeding_health_and_protocols.md
- [x] 18_grazing_rotation_and_stocking.md
- [x] 19_herd_land_dashboard_reports_and_polish.md

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


### 09_post_auth_redirects_to_activation.md
Status: DONE
Summary:
- Updated post-auth destination logic to route onboarded users without billing access directly to `/app/billing-required`.
- Kept onboarding-first behavior intact by continuing to route users with incomplete ranch setup to `/onboarding`.
- Switched signup and onboarding-complete server actions to use shared post-auth redirect resolution instead of hardcoded `/app` redirects.
- Updated `/onboarding` page guard to use shared redirect resolution for already-onboarded users, preventing a paid-access bounce through `/app`.
Files changed:
- lib/auth/context.ts
- lib/auth/actions.ts
- app/(auth)/onboarding/page.tsx
Commands to run:
- npm run lint
- npm run typecheck
How to verify:
- 1) Create a new owner account from `/signup`; after onboarding submission confirm redirect goes to `/app/billing-required` when subscription is inactive and no beta code is applied.
- 2) Log in with an existing onboarded unpaid account; confirm direct redirect to `/app/billing-required` instead of `/app`.
- 3) Log in with an account that has active/trialing subscription or beta lifetime access; confirm redirect lands on `/app`.
- 4) Open `/onboarding` while logged in with an onboarded unpaid account; confirm redirect goes to `/app/billing-required`.

### 10_billing_required_activation_hub.md
Status: DONE
Summary:
- Replaced the thin `/app/billing-required` shell with a real activation hub tied to current ranch billing state.
- Added owner-first activation actions directly on the page by reusing existing `CheckoutForm` and coupon/beta-code redemption form.
- Added a role-aware non-owner state that clearly explains billing is owner-only and routes users to settings instead of showing unusable controls.
- Added concise blocked-state context (subscription status + beta lifetime flag) and support contact guidance to remove dead-end confusion.
Files changed:
- app/(app)/app/billing-required/page.tsx
Commands to run:
- npm run lint
- npm run typecheck
How to verify:
- 1) Log in as an unpaid owner and open `/app/billing-required`; confirm the page shows activation context plus checkout and coupon code controls.
- 2) Log in as an unpaid non-owner and open `/app/billing-required`; confirm owner-only controls are hidden and a clear owner-action message is shown.
- 3) Apply a valid beta lifetime code as owner on `/app/billing-required`; confirm success messaging appears and access can proceed to paid routes.
- 4) If billing access is already active/trialing, open `/app/billing-required`; confirm redirect to `/app`.

### 11_trial_support_and_checkout_cleanup.md
Status: DONE
Summary:
- Audited checkout flow and confirmed true Stripe trial creation was not previously configured.
- Added real trial support in checkout session creation via optional `STRIPE_TRIAL_DAYS` with strict validation (no frontend-only trial assumptions).
- Limited trial use to eligible ranches (inactive status, no prior Stripe subscription ID, no beta lifetime access) while preserving normal paid checkout fallback.
- Added checkout return-path handling so activation flow can return users to `/app/billing-required` with clear `success` / `trial_started` / `cancel` messaging.
- Updated owner-facing checkout messaging on activation, settings, and public checkout screens to clarify when a Stripe trial is available.
- Documented trial env/config and behavior in `.env.example`, `README`, and billing docs.
Files changed:
- lib/billing/trial.ts
- lib/billing/actions.ts
- components/billing/checkout-form.tsx
- app/(app)/app/billing-required/page.tsx
- app/(app)/app/settings/page.tsx
- app/(public)/checkout/page.tsx
- .env.example
- README.md
- docs/billing.md
Commands to run:
- npm run lint
- npm run typecheck
How to verify:
- 1) Set `STRIPE_TRIAL_DAYS` to a valid whole number (example: `14`) and ensure Stripe env vars are configured.
- 2) Log in as an unpaid owner with no prior Stripe subscription and start checkout from `/app/billing-required`; confirm Stripe checkout starts with trial messaging and returns to `/app/billing-required?billing=trial_started` on success.
- 3) Send/receive Stripe webhook updates and confirm ranch subscription state moves to `trialing`, unlocking paid routes.
- 4) Repeat checkout for a ranch that is no longer trial-eligible; confirm checkout still works but follows normal paid `success` messaging.
- 5) Open `/app/settings` and `/checkout`; confirm trial offer messaging is present only when eligible and no confusing trial copy appears otherwise.

### 12_settings_customer_portal_and_cancel.md
Status: DONE
Summary:
- Audited and expanded settings billing visibility with clearer access source and Stripe identifiers (customer/subscription) while preserving beta-lifetime distinction.
- Added owner-only Stripe Customer Portal launch action (`createCustomerPortalSessionAction`) for real subscription management/cancellation.
- Added reusable owner billing UI control (`CustomerPortalForm`) and integrated it into `/app/settings` with clear guidance.
- Added settings return-state messaging for portal navigation (`billing=portal_return`) to reduce confusion after manage/cancel actions.
- Documented customer portal setup/usage expectations in billing docs.
Files changed:
- lib/billing/actions.ts
- components/billing/customer-portal-form.tsx
- app/(app)/app/settings/page.tsx
- docs/billing.md
Commands to run:
- npm run lint
- npm run typecheck
How to verify:
- 1) Log in as owner, open `/app/settings`, and confirm billing card shows access source plus Stripe customer/subscription values.
- 2) If the ranch has a Stripe customer ID, click `Manage or cancel in Stripe` and confirm redirect to Stripe Customer Portal.
- 3) Return from portal; confirm `/app/settings?billing=portal_return` shows the return-state message.
- 4) Log in as non-owner and confirm billing controls (checkout, coupon apply, portal manage/cancel) are not shown.
- 5) If no Stripe customer exists yet, confirm owner sees the explanatory message that portal is available after first checkout.

### 13_launch_flow_qa.md
Status: DONE
Summary:
- Ran a focused launch-flow QA pass across landing, auth, onboarding, activation, checkout return states, and owner billing management.
- Tightened checkout safety by blocking new checkout launches when Stripe subscription access is already `active` or `trialing`, steering owners to customer portal management.
- Reduced public-flow copy confusion by making header/pricing CTA language trial-aware without promising trials to ineligible ranches.
- Kept protected-route behavior consistent with activation routing (`/app/billing-required`) and existing owner-only billing controls in settings.
- Verified release quality gates (`lint`, `typecheck`, `build`) all pass after redirect/activation/checkout/settings updates.
Files changed:
- lib/billing/actions.ts
- app/(app)/app/settings/page.tsx
- components/layout/public-header.tsx
- app/(public)/pricing/page.tsx
Commands to run:
- npm run lint
- npm run typecheck
- npm run build
How to verify:
- 1) Open `/` and `/pricing` while logged out; confirm CTA language is clear (no unconditional trial promise when trial config is absent).
- 2) Sign up at `/signup`, complete `/onboarding`, and confirm unpaid owners land on `/app/billing-required` directly.
- 3) From `/app/billing-required`, start checkout (or trial if eligible) and confirm return-state messaging appears on `?billing=success|trial_started|cancel`.
- 4) Apply a valid coupon/beta code on `/app/billing-required`; confirm access unlocks and protected routes (`/app`, `/app/work-orders`, `/app/time`) open.
- 5) Open `/app/settings` as owner and confirm manage/cancel path launches Stripe customer portal when a Stripe customer exists.
- 6) Open `/app/settings` as non-owner and confirm owner billing controls remain hidden with clear guidance.
- 7) With an already `active`/`trialing` ranch, try starting checkout from settings and confirm you are directed to use customer portal instead of opening duplicate checkout.

### 14_herd_land_package_foundation.md
Status: DONE
Summary:
- Expanded the bundled base-plan product story across marketing and billing surfaces to explicitly include herd and land operations.
- Added paid-access app route shells for `/app/herd`, `/app/land`, `/app/herd/breeding`, and `/app/land/grazing`, plus new nav entries.
- Added ranch-scoped herd/land schema foundation with unified animal, event, group, land-unit, location-assignment, and settings tables.
- Added practical enums/indexes/constraints for species sharing (cattle + horses), timeline events, unit types, and active location tracking.
- Added initial herd/land summary query helpers to power polished placeholder dashboards with real ranch-scoped counts.
- Generated Drizzle migration + snapshot updates and verified lint/typecheck/build pass.

Files changed:
- lib/db/schema.ts
- drizzle/0015_overconfident_manta.sql
- drizzle/meta/_journal.json
- drizzle/meta/0015_snapshot.json
- lib/herd-land/queries.ts
- app/(app)/app/herd/page.tsx
- app/(app)/app/herd/loading.tsx
- app/(app)/app/herd/breeding/page.tsx
- app/(app)/app/land/page.tsx
- app/(app)/app/land/loading.tsx
- app/(app)/app/land/grazing/page.tsx
- lib/site-config.ts
- lib/marketing-content.ts
- app/(public)/pricing/page.tsx
- app/(public)/page.tsx
- app/(public)/checkout/page.tsx
- app/(auth)/layout.tsx
- app/(app)/app/settings/page.tsx
- app/(app)/app/billing-required/page.tsx
- app/layout.tsx
- README.md
- docs/billing.md
- docs/demo-walkthrough.md

Commands to run:
- npm run db:generate
- npm run lint
- npm run typecheck
- npm run build

How to verify:
- 1) Run `npm run db:migrate`, then start app with `npm run dev`.
- 2) Open `/pricing` and confirm bundled base messaging includes herd + land in the included feature list.
- 3) Sign in to a paid/beta-enabled ranch account, open `/app`, and confirm sidebar now includes `Herd` and `Land`.
- 4) Open `/app/herd` and `/app/land`; confirm polished shell pages load with real summary cards and no access errors.
- 5) Open `/app/herd/breeding` and `/app/land/grazing`; confirm polished foundation placeholders render inside the app shell.
- 6) For an unpaid ranch, open `/app/herd` or `/app/land`; confirm redirect to `/app/billing-required` still applies.
- 7) Run `npm run lint`, `npm run typecheck`, and `npm run build` and confirm all pass.

### 15_animal_registry_and_lifecycle.md
Status: DONE
Summary:
- Replaced the herd placeholder with a working operational registry list at `/app/herd`, including search and filters for species, status, sex, and class/category.
- Added owner/manager create and edit animal flows with practical fields for cattle and horses (IDs, identity, class, breed, markings, birth/acquisition, lineage, notes).
- Added full animal detail route at `/app/herd/[animalId]` with identity, status, current location, lifecycle summary, sire/dam links, and event timeline.
- Implemented structured lifecycle event actions (birth, acquisition, death, sale/disposition, cull, note) that update current animal status while preserving history.
- Added tenant-safe query/action modules with status-transition guardrails, parent reference validation, and active-location cleanup on terminal lifecycle states.
- Added schema extensions + migration for lifecycle support fields (`color_markings`, `is_birth_date_estimated`) and new enum values (`cull`, `culled`).

Files changed:
- app/(app)/app/herd/page.tsx
- app/(app)/app/herd/loading.tsx
- app/(app)/app/herd/[animalId]/page.tsx
- components/herd/create-animal-form.tsx
- components/herd/edit-animal-form.tsx
- components/herd/record-animal-event-form.tsx
- lib/herd/constants.ts
- lib/herd/queries.ts
- lib/herd/actions.ts
- lib/db/schema.ts
- drizzle/0016_fine_masque.sql
- drizzle/meta/_journal.json
- drizzle/meta/0016_snapshot.json

Commands to run:
- npm run db:generate
- npm run lint
- npm run typecheck
- npm run build

How to verify:
- 1) Run `npm run db:migrate`, then start app with `npm run dev` and log in as owner or manager.
- 2) Open `/app/herd`, add an animal with tag/internal ID plus optional lifecycle fields, and confirm it appears in the registry table.
- 3) Use search + filters (`species`, `status`, `sex`, `class`) and confirm table rows update to match selections.
- 4) Open `/app/herd/[animalId]` from the registry `Open` action and confirm identity, current location, lineage links, and lifecycle summary render.
- 5) On detail page, record lifecycle events (`birth`, `acquisition`, `death`, `sale/disposition`, `cull`, `note`) and confirm timeline entries appear with status updates.
- 6) Edit the animal record (including sire/dam links and status) and confirm updates persist and guardrails prevent invalid lineage/status changes.
- 7) Log in as a worker role and confirm herd registry/detail are viewable while create/edit/event controls are hidden.
- 8) Run `npm run lint`, `npm run typecheck`, and `npm run build` and confirm pass.

### 16_land_units_movements_corrals_and_horses.md
Status: DONE
Summary:
- Replaced the land placeholder with a production-style `/app/land` inventory surface including search, unit-type/activity filters, occupancy counts, and horse-occupancy visibility.
- Added owner/manager create and edit flows for land units (name/code/type, acreage/grazeable acreage, active status, water/fencing summaries, notes).
- Added detailed land-unit route `/app/land/[landUnitId]` with identity, acreage, “who is here now” occupancy table, and assignment history timeline.
- Implemented server-side movement workflows to assign animals, move between units, and remove occupants while preserving structured assignment history.
- Movement actions now create structured animal movement events and revalidate herd + land views so current location/occupancy refresh coherently.
- Kept one shared system for pasture/lot/corral/pen/stall and horse-friendly labels without introducing a separate horse subsystem.

Files changed:
- app/(app)/app/land/page.tsx
- app/(app)/app/land/loading.tsx
- app/(app)/app/land/[landUnitId]/page.tsx
- app/(app)/app/land/[landUnitId]/loading.tsx
- components/land/create-land-unit-form.tsx
- components/land/edit-land-unit-form.tsx
- components/land/move-animal-form.tsx
- components/land/remove-animal-from-unit-form.tsx
- lib/land/constants.ts
- lib/land/queries.ts
- lib/land/actions.ts

Commands to run:
- npm run lint
- npm run typecheck
- npm run build

How to verify:
- 1) Start app with `npm run dev`, sign in as owner/manager, and open `/app/land`.
- 2) Create units for mixed scales (example: pasture, corral, stall) and confirm rows render with type, acreage, and occupancy data.
- 3) Use search + unit-type/activity filters on `/app/land` and confirm list updates correctly.
- 4) Open `/app/land/[landUnitId]`, use “Move animal” to assign or move an active animal into the unit, and confirm occupancy updates immediately.
- 5) From current occupancy table, use `Remove` on an occupant and confirm animal leaves current-occupancy view while history retains the movement row.
- 6) Open the moved animal’s `/app/herd/[animalId]` detail and confirm current location reflects the latest assignment state.
- 7) Log in as worker and confirm land inventory/detail remain viewable but create/edit/movement controls are hidden.
- 8) Run `npm run lint`, `npm run typecheck`, and `npm run build` and confirm pass.

### 17_breeding_health_and_protocols.md
Status: DONE
Summary:
- Added structured breeding, pregnancy-check, and health record actions/forms on animal detail using tenant-safe server actions and event-data payloads.
- Expanded `/app/herd/[animalId]` with reproductive timeline summaries (last breeding, latest pregnancy outcome, expected birth planning, offspring linkage) and recent health activity.
- Rebuilt `/app/herd/breeding` into a working protocols workspace with due-soon/overdue visibility, recent breeding/health activity, and trust framing around configurable reminders.
- Added ranch-scoped protocol template model and management flows (create + activate/pause) without hardcoding a fixed national schedule.
- Added due-list calculation logic that evaluates active protocol templates against ranch animals and latest matching event history.
- Kept guidance operational (not veterinary advice), preserved tenant boundaries, and validated quality gates after migration.

Files changed:
- lib/db/schema.ts
- drizzle/0017_magenta_kat_farrell.sql
- drizzle/meta/_journal.json
- drizzle/meta/0017_snapshot.json
- lib/herd/constants.ts
- lib/herd/queries.ts
- lib/herd/protocol-queries.ts
- lib/herd/records-actions.ts
- components/herd/breeding-record-form.tsx
- components/herd/pregnancy-check-form.tsx
- components/herd/health-record-form.tsx
- components/herd/protocol-template-form.tsx
- components/herd/toggle-protocol-template-form.tsx
- app/(app)/app/herd/page.tsx
- app/(app)/app/herd/[animalId]/page.tsx
- app/(app)/app/herd/breeding/page.tsx

Commands to run:
- npm run db:generate
- npm run lint
- npm run typecheck
- npm run build

How to verify:
- 1) Run `npm run db:migrate`, start app with `npm run dev`, and sign in as owner/manager.
- 2) Open `/app/herd/[animalId]` for an existing animal and record: (a) breeding event, (b) pregnancy check, and (c) health record; confirm each appears in timeline.
- 3) On the same detail page, confirm reproductive summary updates (last breeding timestamp, latest pregnancy outcome, expected birth estimate, offspring link when set).
- 4) Open `/app/herd/breeding`, create protocol templates with different interval/due-soon settings, and confirm they appear in the templates table.
- 5) Confirm due-list rows populate with `overdue`/`due soon` badges and link back to animal detail.
- 6) Use `Pause` / `Activate` on a template and confirm due-list visibility adjusts after refresh/revalidation.
- 7) Log in as worker and confirm breeding/health/protocol edit controls are hidden while read surfaces remain viewable.
- 8) Run `npm run lint`, `npm run typecheck`, and `npm run build` and confirm pass.

### 18_grazing_rotation_and_stocking.md
Status: DONE
Summary:
- Added grazing-planning data model with `grazing_periods` and `grazing_period_animals` plus new land-unit planning inputs (forage lbs/acre, utilization target, rest target, seasonal notes).
- Built ranch-configurable grazing assumptions management backed by `herd_land_settings.grazingDefaults` (demand basis, species multipliers, utilization/rest defaults, class overrides).
- Replaced `/app/land/grazing` placeholder with a full operational workspace: assumptions form, grazing-period logging, active-use board, rotation-soon/overdue visibility, and rest tracking.
- Implemented transparent estimate logic (available forage, demand/day, estimated grazing days, projected move date) with explicit missing-input messaging when precision is unavailable.
- Added grazing-period completion workflow and land-unit grazing history surface on `/app/land/[landUnitId]` to preserve timeline and rest-window context.
- Updated land create/edit flows and detail to include practical grazing inputs while keeping formulas visible and non-authoritative.

Files changed:
- lib/db/schema.ts
- drizzle/0018_furry_bloodscream.sql
- drizzle/meta/_journal.json
- drizzle/meta/0018_snapshot.json
- lib/land/actions.ts
- lib/land/queries.ts
- components/land/create-land-unit-form.tsx
- components/land/edit-land-unit-form.tsx
- app/(app)/app/land/page.tsx
- app/(app)/app/land/[landUnitId]/page.tsx
- app/(app)/app/land/grazing/page.tsx
- app/(app)/app/land/grazing/loading.tsx
- lib/grazing/settings.ts
- lib/grazing/actions.ts
- lib/grazing/queries.ts
- components/grazing/grazing-assumptions-form.tsx
- components/grazing/create-grazing-period-form.tsx
- components/grazing/complete-grazing-period-form.tsx

Commands to run:
- npm run db:generate
- npm run lint
- npm run typecheck
- npm run build

How to verify:
- 1) Run `npm run db:migrate`, then `npm run dev`, sign in as owner/manager, and open `/app/land/grazing`.
- 2) Save ranch assumptions in the assumptions card (demand basis, utilization/rest defaults, multipliers) and confirm success state.
- 3) Record a grazing period linking a land unit plus optional animals/group; confirm it appears in active/recent grazing views.
- 4) For an active period with sufficient inputs (grazeable acreage + forage lbs/acre + participants), confirm estimate snapshot and projected move date render.
- 5) For periods missing key inputs, confirm UI shows explicit `Missing: ...` messaging instead of fake precision.
- 6) Use `Mark completed` on an active period and confirm it moves into history/rest tracking updates.
- 7) Open `/app/land/[landUnitId]` and confirm grazing period history table appears with linked-animal counts and period windows.
- 8) Run `npm run lint`, `npm run typecheck`, and `npm run build` and confirm pass.

### 19_herd_land_dashboard_reports_and_polish.md
Status: DONE
Summary:
- Added herd/land operational visibility to `/app` with new summary cards, due-attention table, and recent movement table so the bundled package is visible from dashboard home.
- Added practical CSV exports for launch reporting: herd inventory, herd due list, current occupancy by unit, movement history, and grazing/rest summary by unit.
- Polished herd/land surfaces with loading coverage (`/app/herd/[animalId]`, `/app/herd/breeding`) and role-aware action visibility while preserving paid-access and tenant boundaries.
- Improved demo seed coherence with realistic herd/land records (cattle + horse, occupancy, grazing period, protocol activity) and idempotent movement seeding behavior.
- Updated product/demo docs so bundled herd/land functionality, exports, and walkthrough steps match the shipped app behavior.

Files changed:
- app/(app)/app/page.tsx
- app/(app)/app/herd/page.tsx
- app/(app)/app/herd/[animalId]/loading.tsx
- app/(app)/app/herd/breeding/loading.tsx
- app/(app)/app/herd/export/route.ts
- app/(app)/app/land/page.tsx
- app/(app)/app/land/grazing/page.tsx
- app/(app)/app/land/export/route.ts
- lib/herd/reporting.ts
- lib/land/reporting.ts
- scripts/seed-demo.ts
- README.md
- docs/demo-walkthrough.md

Commands to run:
- npm run lint
- npm run build
- npm run typecheck
- ALLOW_DEMO_SEED=true npm run seed:demo

How to verify:
- 1) Start app with `npm run dev` and sign in as owner/manager on a paid/beta-enabled ranch.
- 2) Open `/app` and confirm herd/land stats render (active animals, due attention, occupied units, active grazing) plus due-attention and recent-movement tables.
- 3) Open `/app/herd` and click `Export inventory CSV` and `Export due-list CSV`; confirm both downloads succeed.
- 4) Open `/app/land` and click `Export occupancy CSV` and `Export movement CSV`; confirm both downloads succeed.
- 5) Open `/app/land/grazing` and click `Export grazing/rest CSV`; confirm download succeeds and rows reflect rest-state data.
- 6) As worker role, revisit herd/land pages and confirm management actions/exports are hidden while read surfaces remain available.
- 7) Run `ALLOW_DEMO_SEED=true npm run seed:demo`, then verify seeded herd/land activity appears across `/app`, `/app/herd`, `/app/land`, and `/app/land/grazing`.
- 8) Run `npm run lint`, `npm run build`, and `npm run typecheck`; confirm all pass.
