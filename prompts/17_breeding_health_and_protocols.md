# Prompt 17 — Breeding workflows + health records + configurable protocols

## Objective
Add breeding and health recordkeeping to the base Herd & Land package.

This prompt should allow a ranch to:
- record breeding-related events
- record pregnancy checks and expected birth planning
- record health/treatment/vaccination/deworming history
- see upcoming due items from configurable ranch-scoped protocols

## Constraints
- Do NOT hardcode one “correct” national vaccine schedule.
- Health and breeding reminders must be configurable at the ranch level.
- The app should help with operational records and due tracking, not act as veterinary medical advice.
- Keep species support broad enough for cattle and horses.
- Do NOT build medication inventory, prescription management, or dosing calculators yet.

## Tasks

1) Breeding records
Support structured breeding/reproduction records such as:
- exposed / bred / serviced
- sire / bull / stallion linkage when known
- breeding date or service window
- pregnancy check
- open / bred / confirmed / unknown outcome states
- expected calving / foaling planning fields
- actual birth outcome linkage into animal events where practical

2) Reproductive timeline and summaries
Animal detail should surface key reproductive status where relevant.
At minimum, users should be able to see:
- last breeding/service record
- latest pregnancy status
- expected birth estimate or planning window if applicable
- related offspring linkage after birth when known

3) Health records
Support structured health records such as:
- vaccination
- treatment
- deworming
- injury / illness note
- procedure / exam
- death/loss health note if helpful

Each should capture practical equivalents of:
- date
- type
- product/procedure summary
- lot/batch or serial if helpful
- withdrawal/hold note if helpful
- notes
- who recorded it if practical

4) Ranch-configurable protocols
Add ranch-scoped protocol templates or practical equivalents for due tracking, such as:
- vaccination schedule templates
- deworming reminder templates
- pregnancy-check timing reminders
- pre-breeding / pre-calving / pre-foaling planning reminders

These should generate “due soon / overdue” style visibility without pretending to be one universal standard.

5) Due list surfaces
Create useful due-list visibility on herd pages and/or dedicated breeding/health surfaces so a ranch can quickly see:
- upcoming checks
- overdue items
- recent breeding activity
- recent health activity

6) Copy and trust framing
Where helpful, clarify that protocols are ranch-configurable operational reminders and should align with the ranch’s veterinarian and management approach.

7) Guardrails
- Keep all health/breeding records tenant-safe.
- Do not allow breeding/health UI to break animal timelines.
- Keep the workflows practical and not overcomplicated.

## Acceptance Criteria
- Users can record structured breeding and health events.
- Animal detail surfaces show meaningful reproductive and health history.
- Ranch-scoped protocol reminders exist and can drive due/overdue visibility.
- The system remains configurable rather than locked to one fixed national schedule.
- Build, lint, and typecheck succeed.

## Output Format
- Files changed
- Commands to run
- How to verify (click-by-click)