# Architecture Baseline

## App Structure

- `app/` App Router routes and layouts
- `components/` reusable UI, page patterns, and layout shells
- `lib/` utilities, site config, and DB modules
- `lib/db/` Drizzle schema and client
- `drizzle/` generated migrations
- `prompts/` execution queue and prompt specs

## Layout Model

- Public layout for marketing and pricing
- Auth layout for login/signup
- App layout with persistent sidebar + top bar

## Data Layer

- PostgreSQL-ready via `postgres` + Drizzle
- Core tenant/auth tables included:
  - `users`
  - `ranches`
  - `ranch_memberships`
  - `sessions`
