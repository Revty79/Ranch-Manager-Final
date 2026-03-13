# Ranch Manager Final

Ranch Manager Final is a production-minded Next.js SaaS build for ranch operations:
crew, work orders, time, payroll visibility, and billing access controls.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- Drizzle ORM (PostgreSQL-ready)
- Reusable UI primitives + app/public shells

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment baseline:

```bash
cp .env.example .env
```

PowerShell equivalent:

```powershell
Copy-Item .env.example .env
```

3. Start the app:

```bash
npm run dev
```

4. Open `http://localhost:3000`.

## Environment Variables

Core:

- `DATABASE_URL`
- `APP_URL` (local dev: `http://localhost:3000`; production: your real HTTPS domain used for Stripe return URLs)
- `APP_SECRET`
- `SESSION_COOKIE_NAME`

Stripe billing:

- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID` (use recurring `price_...`; `prod_...` works if it has a default recurring price)
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_TRIAL_DAYS` (optional whole-number day count for first-checkout Stripe trials)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

Optional:

- `PLATFORM_ADMIN_EMAILS` (comma-separated allowlist for `/admin`)
- `BILLING_COUPON_PEPPER` (optional secret for coupon hashing; falls back to `APP_SECRET`)
- `ALLOW_DEMO_SEED=true` (required to run demo seed)
- `DEMO_SEED_PASSWORD` (override default demo password)

## Quality Commands

```bash
npm run lint
npm run typecheck
npm run build
```

## Database Commands

```bash
npm run db:generate
npm run db:migrate
npm run db:push
npm run db:studio
```

Drizzle schema source: `lib/db/schema.ts`.
Migration output: `drizzle/`.

## Admin Console

- Set `PLATFORM_ADMIN_EMAILS` with one or more login emails.
- Sign in through normal auth, then open `/admin`.
- Admin can:
  - review all users/ranches
  - set ranch billing state and beta lifetime access
  - create and manage internal coupon codes

## Demo Seed

Safe non-production demo seed:

```bash
ALLOW_DEMO_SEED=true npm run seed:demo
```

Default seeded credentials:

- `owner@demoranch.local`
- `manager@demoranch.local`
- `worker@demoranch.local`
- password: `DemoRanch123!`

## Deploy Notes

1. Set production environment variables.
2. Build and start:

```bash
npm install
npm run build
npm run start
```

3. Run migrations:

```bash
npm run db:migrate
```

4. Configure Stripe webhook endpoint:

`https://<your-domain>/api/stripe/webhook`

Additional deployment/demo docs:

- `docs/deploy-render.md`
- `docs/billing.md`
- `docs/demo-walkthrough.md`
