# Prompt 00 — Foundation scaffold + design system + app shell

## Objective
Create the clean foundation for Ranch Manager Final:
- Next.js App Router app
- TypeScript
- PostgreSQL-ready data layer
- modern design system
- polished public and app shell layouts
- repo structure ready for the remaining prompts

The result should look like a real product from day one, not a developer sandbox.

## Constraints
- Keep the repo clean and production-minded.
- Use a single app/repo.
- Use server-side patterns for sensitive logic.
- Keep architecture simple enough for one small team to maintain.
- The UI must feel intentionally branded, crisp, and trustworthy.
- Do NOT implement full business logic yet.
- Do NOT implement billing yet.
- Do NOT implement expansion modules yet.

## Required stack
Use a practical, stable stack that fits this project:
- Next.js App Router
- TypeScript
- Tailwind CSS
- a small reusable UI component system
- PostgreSQL-ready DB setup
- Drizzle ORM

If a small support library is needed for forms, validation, or tables, keep choices conservative and well-documented.

## Tasks
1) Create or normalize the project structure.

Recommended structure:
- `app/`
- `components/`
- `lib/`
- `drizzle/`
- `public/`
- `prompts/`
- `docs/` (optional)

2) Set up the base app shell.
- Public layout for marketing/auth pages
- Authenticated app layout for internal product pages
- Consistent header, page container, spacing rules, and card styles
- Global theme tokens for color, radius, spacing, shadows, typography

3) Establish visual direction.
The design should feel:
- grounded
- modern
- capable
- trustworthy
- calm

Avoid:
- cartoon ranch styling
- novelty western themes
- visual clutter
- default-looking starter UI

4) Create route placeholders and page shells for:
- `/`
- `/pricing`
- `/login`
- `/signup`
- `/app`
- `/app/team`
- `/app/work-orders`
- `/app/time`
- `/app/payroll`
- `/app/settings`

5) Create shared UI primitives/patterns.
At minimum:
- page header
- section header
- stat card
- empty state
- loading state
- error state
- badge
- data table shell
- form field shell
- confirmation dialog shell
- access-denied / billing-required state shells

6) Create env and config baselines.
- `.env.example`
- DB connection variable(s)
- app secret placeholder(s)
- Stripe env placeholders (do not wire yet)
- README basics for local run

7) Add code quality basics.
- lint
- build
- typecheck
- clear scripts in `package.json`

8) Make the app present well even before features exist.
- good empty states
- clean typography
- visually coherent dashboard placeholder
- no ugly dead-end pages

## Acceptance Criteria
- App runs locally without mystery scaffolding issues.
- Public pages and app shell routes load successfully.
- Design already feels like a product worth taking seriously.
- Shared layout/components make future prompts faster and more consistent.
- `npm run build`, lint, and typecheck succeed.

## Output Format
- Files changed/created
- Commands to run
- How to verify (click-by-click)
