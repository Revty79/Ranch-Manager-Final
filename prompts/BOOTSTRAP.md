# Codex Bootstrap — Continue the Ranch Manager Final Prompt Queue

You are Codex working in this repository.

## Your job
Continue Ranch Manager Final by executing the prompt files in `/prompts/` in numeric order, using `STATUS.md` as the single source of truth.

This repository already contains a substantial working implementation. Your job is to extend, tighten, and polish the current app incrementally — not to rebuild it from scratch.

The product you are continuing is:
- a polished, production-minded ranch operations SaaS
- multi-tenant by ranch/account
- paid from launch, with launch-flow hardening in progress
- visually strong enough to sell
- built around a single bundled base subscription for this phase

## Process (repeat until done)
1) Open and read `/prompts/STATUS.md`.
2) Find the FIRST prompt in the Queue that is not checked `[ ]`.
3) Open that prompt file (example: `/prompts/14_herd_land_package_foundation.md`).
4) Implement it completely.
5) Update `/prompts/STATUS.md`:
   - Change that item in the Queue from `[ ]` to `[x]`
   - In the matching Run Log section, fill in:
     - Status: DONE
     - Summary (2–6 bullets)
     - Files changed
     - Commands to run
     - How to verify (click-by-click)
6) Immediately continue to the next unchecked prompt.
7) Stop only when the Queue is fully checked off or a true blocker prevents safe progress.

## Global rules
- Keep changes scoped to the current prompt.
- Always keep the app runnable after each prompt.
- Do NOT invent features beyond the prompt.
- Do NOT rebuild the application from scratch.
- Prefer extending, tightening, and normalizing existing implementations over replacing them.
- Reuse existing routes, components, helpers, and billing/auth flows where practical.
- Keep the codebase single-repo and easy to reason about.
- Protect tenant boundaries everywhere.
- Protect billing boundaries everywhere.
- Server-side code owns authorization and sensitive business rules.
- UI must feel clean, modern, trustworthy, and sales-ready.
- Avoid kitschy western styling; use a professional ranch-business aesthetic.
- Every screen must look intentionally designed, not merely functional.
- Responsive behavior is required for laptop and desktop widths; mobile support can be practical rather than perfect for now.
- Empty states, loading states, error states, and access-denied states must be humane and clear.
- Do not add background workers, automation engines, or expansion modules unless the prompt explicitly asks for them.

## Existing implementation to preserve and build on
The repo already includes substantial work in these areas:
- public landing page
- auth flow
- onboarding flow
- `/app` shell and core sections
- billing-required flow
- Stripe checkout/webhook groundwork
- settings billing surface
- beta/lifetime access support

When prompts touch these areas:
- improve and normalize them
- do not create parallel systems unless truly necessary
- do not replace working architecture casually

## Product guardrails
The bundled base subscription for this phase includes:
- crew
- work
- time
- payroll
- herd management
- land management
- corral / pen / stall management
- horse support within the same operational model
- billing access

Billing/model rules for this run:
- Keep the app on one bundled base subscription path unless a prompt explicitly requires otherwise.
- Do NOT introduce add-on billing architecture in this run unless a prompt explicitly asks for it.
- Granted/free/beta/lifetime access should continue to unlock the full bundled base product.
- Reuse existing Stripe, billing-required, and entitlement patterns where practical.

Do NOT build these unless a later prompt explicitly asks for them:
- financial accounting suite
- internal chat or broad communications
- advanced automation
- AI features
- mobile app
- GIS/satellite mapping
- hardware/EID integrations
- feed inventory / medicine inventory systems
- compliance-heavy reporting suites beyond what prompts explicitly require

## Quality bar
Every prompt should move the product closer to a state where a real ranch owner could:
- sign up
- create a ranch
- activate access
- add team members
- create and assign work
- track time
- review payroll
- manage billing
- register and manage herd animals
- track lifecycle, breeding, and health records
- manage land units, grazing, corrals, pens, and stalls

## Domain realism rules
When implementing herd, horse, breeding, health, land, and grazing features:
- Favor practical U.S. ranch operations recordkeeping over niche show/pedigree workflows.
- Prefer structured records and history/timelines over freeform notes.
- Keep cattle and horses in one shared animal model unless a prompt explicitly requires otherwise.
- Keep pasture, lot, corral, pen, stall, and related spaces in one shared land-unit model unless a prompt explicitly requires otherwise.
- Do NOT hardcode one universal U.S. vaccine schedule, breeding protocol, stocking rule, or grazing-rest rule.
- Where calculations or reminders are needed, make assumptions transparent and ranch-configurable.
- Do not present estimates as guaranteed agronomic or veterinary truth.

## Start now
Begin with the first unchecked item in `/prompts/STATUS.md`.