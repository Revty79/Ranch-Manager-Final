# Demo Walkthrough

## Optional Seed

```bash
ALLOW_DEMO_SEED=true npm run seed:demo
```

## Public Demo Entry (Optional)

- Enable guided public demo route at `/demo` with:
  - `PUBLIC_DEMO_ENABLED=true`
  - `PUBLIC_DEMO_RANCH_SLUG=demo-ranch`
  - `PUBLIC_DEMO_MEMBER_EMAIL=manager@demoranch.local`
- Demo entry signs users into a non-owner demo account so owner billing controls are not exposed.

Demo credentials (default):

- `owner@demoranch.local`
- `manager@demoranch.local`
- `worker@demoranch.local`
- password: `DemoRanch123!` (or `DEMO_SEED_PASSWORD`)

## End-to-End Demo Flow

1. Visit landing page (`/`) and pricing page (`/pricing`).
2. Sign up (`/signup`) and create ranch (`/onboarding`).
3. Open settings (`/app/settings`) and start checkout or apply coupon code.
4. Add team members (`/app/team`).
5. Create and assign work orders (`/app/work-orders`).
6. Track shift and task time (`/app/time`).
7. Review payroll and export CSV (`/app/payroll`).
8. Open app dashboard (`/app`) and confirm herd/land visibility cards plus due-attention and recent-movement sections.
9. Manage animals in registry/detail views (`/app/herd`, `/app/herd/[animalId]`) and confirm lifecycle, breeding, and health timeline updates.
10. Open breeding workspace (`/app/herd/breeding`) and review due/overdue protocol items.
11. Manage land-unit occupancy/movement (`/app/land`, `/app/land/[landUnitId]`) and confirm movement history coherence.
12. Open grazing workspace (`/app/land/grazing`) and review active periods, rest tracking, and estimate transparency.
13. Export operational CSVs:
    - herd inventory: `/app/herd/export?type=inventory`
    - herd due list: `/app/herd/export?type=due`
    - land occupancy: `/app/land/export?type=occupancy`
    - land movement: `/app/land/export?type=movement`
    - land grazing/rest: `/app/land/export?type=grazing_rest`
14. Confirm billing/access state messaging in settings and billing-required views.
