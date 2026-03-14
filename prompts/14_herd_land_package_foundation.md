
# Prompt 14 — Herd & Land package foundation + bundled base-plan update

## Objective
Extend Ranch Manager Final so Herd & Land Management becomes part of the base subscription offering.

This prompt should:
- preserve the existing single paid subscription architecture
- update the product story and pricing surface to reflect the new bundled base plan
- add the shared schema and route foundation needed for herd, land, grazing, corrals, and horses
- keep the app clean, sales-ready, and tenant-safe

The result after this prompt should be:
- one clear base subscription path
- updated pricing/marketing language
- nav/routes ready for herd and land
- database foundation ready for later herd/land prompts

## Constraints
- Reuse the existing auth, tenancy, billing, checkout, webhook, and billing-required flows.
- Do NOT introduce multi-plan Stripe complexity in this prompt.
- Do NOT create a separate paid add-on system yet.
- Manual/granted/beta/lifetime access should continue to unlock the full base app, including herd and land.
- Keep tenant boundaries enforced server-side.
- Do NOT implement the full herd/land feature set yet; this is the foundation prompt.
- Do NOT create separate animal systems for cattle vs horses.
- Do NOT create separate land systems for pasture vs corrals vs pens.

## Product model for this phase
The base subscription should now represent:
- crew
- work
- time
- payroll
- herd management
- land management
- corral / pen / stall management
- horse support within the same operational model

Future add-ons can come later, but this prompt should keep the current launch architecture to a single paid base subscription.

## Tasks

1) Update bundled base-plan messaging
- Update public pricing/marketing copy so the base subscription is clearly presented as the new bundled core offer.
- Make the pricing page feel intentional and simple.
- Update feature-included lists anywhere needed so herd/land is described as included in the base product.
- Update app/settings billing language where appropriate so the paid state aligns with the new bundled base promise.
- Update docs/readme/billing docs only where needed so the product promise is internally consistent.

2) Add primary navigation and route shells
Create or normalize route shells for:
- `/app/herd`
- `/app/land`

If useful for future prompt clarity, add non-final placeholder route shells for:
- `/app/herd/breeding`
- `/app/land/grazing`

These must look polished even before full business logic is completed.

3) Add shared herd/land schema foundation
Introduce practical, future-safe equivalents for:
- animals
- animal_groups
- animal_group_memberships
- animal_events
- land_units
- animal_location_assignments
- herd_land_settings (or equivalent ranch-scoped settings structure)

Minimum goals:
- every herd/land record is ranch-scoped
- the schema supports timeline/history
- the schema supports current location via active assignment
- the schema supports both cattle and horses in one model
- the schema supports both pasture-scale and corral/stall-scale land units in one model

4) Animal schema expectations
The animal foundation should support practical equivalents of:
- internal id
- ranch id
- tag / visual id
- alternate id / official id (optional)
- display name (optional)
- species
- sex
- class/category
- breed
- status
- birth date
- sire animal id (optional)
- dam animal id (optional)
- acquisition / disposition summary fields
- archived flag / timestamps as needed
- notes summary field if useful

Do not overbuild pedigree-specific logic yet.

5) Animal event schema expectations
The event foundation should support structured history for future prompts, such as:
- birth
- acquisition
- breeding
- pregnancy check
- vaccination
- treatment
- deworming
- movement
- death
- sale / disposition
- note / observation

The event model should be generic enough to support multiple species and future reporting.

6) Land unit schema expectations
The land-unit foundation should support practical equivalents of:
- ranch id
- name
- unit type
- active/inactive status
- acreage
- grazeable acreage
- sort order / code if helpful
- water/fencing/notes summary fields if useful
- current use / current status summary fields if useful

Unit types must be flexible enough to support:
- pasture
- field
- trap
- lot
- corral
- pen
- stall
- barn area / holding area

7) Location assignment foundation
Add active assignment support so current location is represented by a structured record rather than only a text field on the animal.
The model should support:
- individual animal assignments
- movement history
- current occupancy reporting later
- future batch movement workflows

8) Herd/Land settings foundation
Add ranch-scoped settings sufficient for later prompts, such as:
- editable species defaults
- editable reproductive planning defaults
- editable grazing-planning defaults
- editable calculation assumptions
Keep this minimal but real.

9) App integration and safety
- Add herd/land nav entries in the app shell.
- Ensure billing-required users still respect current access gates.
- Ensure granted/lifetime access users can reach the new herd/land surfaces.
- Ensure role visibility is consistent with the rest of the app.

## Acceptance Criteria
- Pricing/marketing/billing copy no longer implies that the product stops at crew/time/payroll.
- The product still uses one clean paid subscription path.
- `/app/herd` and `/app/land` render polished shells inside the current app.
- The schema foundation supports animals, events, land units, and location assignments without obvious dead ends.
- All new records remain tenant-safe and ranch-scoped.
- Build, lint, and typecheck succeed.

## Output Format
- Files changed
- Commands to run
- How to verify (click-by-click)