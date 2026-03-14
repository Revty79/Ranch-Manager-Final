# Prompt 18 — Grazing rotation + rest tracking + transparent stocking estimates

## Objective
Build the grazing-planning layer for the base Herd & Land package.

This prompt should let a ranch:
- plan and record grazing use across land units
- track rest periods and grazing periods
- review movement timing
- use transparent stocking/grazing estimates when enough inputs exist

## Constraints
- Do NOT pretend true carrying capacity can be calculated from acreage alone.
- Grazing calculations must be transparent, labeled as estimates, and based on user-entered assumptions.
- Keep all calculation assumptions ranch-configurable.
- Do NOT hardcode one national rest-period rule or one universal animal-unit table.
- If key inputs are missing, the app should still support planning/logging without fake precision.

## Tasks

1) Add grazing-planning inputs
Support practical land and ranch inputs such as:
- grazeable acreage
- estimated available forage input or equivalent planning input
- target utilization percentage
- target rest period
- seasonal or unit-level notes
- default herd-planning assumptions at the ranch level

2) Ranch-configurable calculation assumptions
Support editable settings for practical equivalents of:
- planning demand basis
- animal-unit / class multipliers
- default utilization assumptions
- default rest targets
- optional species/class overrides

Keep the settings transparent and editable.

3) Grazing plans and logs
Support the ability to:
- mark a grazing period on a land unit
- associate animals/groups with that grazing period where practical
- record start/end dates
- record rest windows between grazings
- review simple history on the land unit

4) Transparent planning estimates
When enough inputs are present, provide planning estimates such as:
- estimated herd demand
- estimated available forage
- estimated grazing days
- projected move date

These should clearly surface the underlying assumptions and should fail gracefully when data is incomplete.

5) Operational views
Create a useful grazing-oriented view or section that helps users see:
- what units are currently in use
- what units are resting
- what units may be due for rotation soon
- recent or upcoming planned moves

6) Guardrails and honesty
- No magic “correct” carrying-capacity claims from thin data.
- No hidden formulas.
- Label estimates as planning tools, not agronomic guarantees.
- Keep the UX useful even for ranches that only want rest/rotation logging without advanced calculations.

## Acceptance Criteria
- Users can record grazing and rest periods.
- The app can support transparent grazing estimates when sufficient inputs exist.
- Assumptions are editable at the ranch level.
- The system remains useful even when only partial land/forage data exists.
- Build, lint, and typecheck succeed.

## Output Format
- Files changed
- Commands to run
- How to verify (click-by-click)