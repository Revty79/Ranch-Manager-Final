# Codex Prompt Queue Status — Ranch Manager Final (Clean Rebuild)

## How this works
- Codex reads this file to find the next unchecked prompt.
- After completing a prompt, Codex checks it off and fills in the matching Run Log section.
- This file is the source of truth for progress.

## Queue
- [x] 00_foundation_scaffold.md
- [x] 01_auth_tenancy_onboarding.md
- [x] 02_public_marketing_access.md
- [ ] 03_team_management.md
- [ ] 04_work_orders.md
- [ ] 05_time_tracking.md
- [ ] 06_payroll.md
- [ ] 07_billing_stripe.md
- [ ] 08_launch_polish_deploy.md

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
Status: TODO
Summary:
- 
Files changed:
- 
Commands to run:
- 
How to verify:
- 

### 04_work_orders.md
Status: TODO
Summary:
- 
Files changed:
- 
Commands to run:
- 
How to verify:
- 

### 05_time_tracking.md
Status: TODO
Summary:
- 
Files changed:
- 
Commands to run:
- 
How to verify:
- 

### 06_payroll.md
Status: TODO
Summary:
- 
Files changed:
- 
Commands to run:
- 
How to verify:
- 

### 07_billing_stripe.md
Status: TODO
Summary:
- 
Files changed:
- 
Commands to run:
- 
How to verify:
- 

### 08_launch_polish_deploy.md
Status: TODO
Summary:
- 
Files changed:
- 
Commands to run:
- 
How to verify:
- 
