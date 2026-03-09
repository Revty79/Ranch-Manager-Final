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
