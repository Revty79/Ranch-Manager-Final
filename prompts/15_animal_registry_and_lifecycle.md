# Prompt 15 — Animal registry + lifecycle + individual animal detail

## Objective
Build the operational herd registry for the base product.

This prompt should turn the herd area into a real working registry where a ranch can:
- add animals
- search/filter animals
- review current status and current location
- record core lifecycle changes
- open an individual animal detail page with structured history

## Constraints
- Use one shared animal system for cattle and horses.
- Do NOT create separate cattle and horse modules.
- Favor structured records over freeform notes.
- Births, deaths, sales, purchases, and status changes should become structured history, not only text notes.
- Keep the UI straightforward for ranch operations, not pedigree-show software.
- Do NOT overbuild breed-association features, pedigree charts, genomics, or registry integrations.

## Tasks

1) Build the herd list surface
Create a polished `/app/herd` experience with:
- searchable list/table/cards
- filters for species
- filters for active/sold/deceased/archived or equivalent
- filters for sex and class/category where practical
- quick visibility into tag/id, name, species, class, status, and current location
- humane empty states

2) Build create/edit flows
Support practical animal create/edit flows with fields such as:
- tag / visual id
- alternate id / official id
- display name
- species
- sex
- class/category
- breed
- color/markings (optional if useful)
- birth date / estimated birth date if appropriate
- sire and dam linkage if known
- acquisition source/date if known
- notes

The form should work for cattle-first workflows while still supporting horses naturally.

3) Build individual animal detail
Create `/app/herd/[animalId]` as a strong detail screen showing:
- key identity and status
- current location
- lifecycle summary
- parent links when present
- recent events / full event timeline
- quick actions for recording structured events

4) Implement lifecycle event workflows
Support practical structured event entry for:
- birth
- acquisition / added to ranch
- death / loss
- sale / disposition
- cull / removed from breeding herd if you use a distinct status
- simple observation note

These should update the animal’s current status where appropriate while preserving history.

5) Current location presentation
Use the active location-assignment model from Prompt 14.
Animal detail must show the current land unit clearly when assigned.

6) Lineage support
Support sire/dam linkage as a practical internal reference.
No advanced pedigree tooling is required, but the user should be able to navigate between linked animals when those records exist.

7) Data-quality guardrails
- Prevent obviously invalid status transitions where practical.
- Avoid duplicate active animals caused by accidental archive/disposition confusion.
- Keep forms calm and forgiving, but do not allow tenant leakage or broken references.

## Acceptance Criteria
- A ranch can create and edit animal records.
- `/app/herd` gives a useful operational registry view, not a placeholder.
- `/app/herd/[animalId]` clearly shows identity, status, location, and timeline.
- Birth/death/acquisition/disposition events are recorded structurally and reflected in animal state.
- Both cattle and horses fit naturally into the same model.
- Build, lint, and typecheck succeed.

## Output Format
- Files changed
- Commands to run
- How to verify (click-by-click)