# Prompt 16 — Land units + movements + corrals/pens/stalls + horse-friendly occupancy

## Objective
Build the shared land and movement layer for the base product.

This prompt should make Ranch Manager Final capable of:
- defining land units from acreage scale down to pen/stall scale
- assigning animals to current locations
- moving animals between land units
- reviewing occupancy/history
- supporting horses naturally without building a separate horse app

## Constraints
- Use one land-unit system for pasture, lot, corral, pen, stall, and other holding areas.
- Current location must come from structured active assignments, not just a text field.
- Do NOT create a separate horse-location subsystem.
- Do NOT build GIS mapping or satellite tools yet.
- Keep movement flows practical for real ranch use.

## Tasks

1) Build the land list surface
Create a polished `/app/land` experience with:
- list/cards/table of land units
- filters by unit type
- active/inactive filtering
- visibility into acreage / grazeable acreage where present
- simple occupancy summary if available
- clear empty states

2) Build create/edit flows for land units
Support practical unit fields such as:
- name
- code / short label if useful
- unit type
- acreage
- grazeable acreage
- active/inactive
- water source summary
- fencing/condition summary
- notes

3) Build land unit detail
Create `/app/land/[landUnitId]` or equivalent with:
- identity and type
- acreage info
- current occupancy summary
- movement history / assignment history
- notes / observations area if useful
- quick actions to move animals in or out

4) Implement movement workflows
Support:
- assign animal to land unit
- move animal from one unit to another
- remove animal from a current unit when appropriate
- preserve structured movement history
- optionally batch move multiple animals in one workflow if it can be done cleanly now

5) Corrals / pens / stalls / horse support
The same movement engine must support:
- corral occupancy
- pen occupancy
- stall occupancy
- horse-friendly records where names are commonly more important than tags

Where helpful, create polished filtered views or labels so these spaces feel intentional for horse and corral workflows without creating a second system.

6) Occupancy presentation
Create a clear “who is here now” view for land-unit detail.
At minimum, users should be able to open a land unit and immediately understand current occupants.

7) Data guardrails
- Avoid duplicate active location assignments for the same animal.
- Preserve movement history.
- Keep all queries ranch-scoped.
- Avoid dead-end UI where a movement action succeeds but current occupancy does not refresh coherently.

## Acceptance Criteria
- A ranch can define pastures, lots, corrals, pens, and stalls in one system.
- Animals can be assigned and moved with history preserved.
- Current occupancy for a unit is clearly visible.
- Horses fit naturally into the same location model.
- The land area looks like a real product surface, not a utility admin page.
- Build, lint, and typecheck succeed.

## Output Format
- Files changed
- Commands to run
- How to verify (click-by-click)