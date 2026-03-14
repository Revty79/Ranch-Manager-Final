# Prompt 19 — Herd & Land dashboard + reports + polish + launch-ready integration

## Objective
Polish the new bundled Herd & Land base package so it feels launch-ready inside the app.

This prompt should unify the prior prompts into a coherent product experience with:
- dashboard visibility
- due-list visibility
- summary reporting
- polished empty/loading/error/access states
- demo-friendly coherence

## Constraints
- Reuse the current design system and app shell.
- Do NOT introduce a new billing model.
- Do NOT add unrelated modules.
- Keep reporting practical and launch-appropriate.
- Favor clarity and trust over flashy complexity.

## Tasks

1) App/dashboard integration
Add practical herd/land summary visibility to the app home and/or the herd/land landing surfaces, such as:
- total active animals
- births / losses / dispositions summary
- due soon breeding/health items
- current occupancy / land-use summary
- grazing/rest summary
- recent movement activity

2) Useful reports / exports
Add a small, practical set of summaries or exports where they provide real operational value, such as:
- herd inventory by species/class/status
- current occupancy by land unit
- recent movement history
- due/overdue breeding or health items
- grazing/rest summary by unit

Do not overbuild analytics.

3) Polish all herd/land surfaces
Ensure:
- clean empty states
- humane no-data states
- loading states
- access-denied / billing-required behavior stays coherent
- cards/tables/forms feel intentionally designed and consistent with the rest of the product

4) Seed/demo coherence
If practical, improve demo seed or demo-readiness so herd/land can be shown in a convincing launch walkthrough.
Do not create unsafe production shortcuts.

5) Docs and verification
Update docs/readme/demo notes where needed so the new bundled base experience is reflected accurately.

## Acceptance Criteria
- Herd & Land feels like part of the real product, not an attached prototype.
- Dashboards and summary views give useful operational visibility.
- Reports/exports are practical and believable for launch.
- The bundled base-plan promise is now reflected consistently across the product.
- Build, lint, and typecheck succeed.

## Output Format
- Files changed
- Commands to run
- How to verify (click-by-click)