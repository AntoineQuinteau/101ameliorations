---
description: Start a build-plan step from a clean context
---

Read, in this order: `CLAUDE.md`, `docs/spec.md`, `docs/handoff.md`.

We are working on step $ARGUMENTS of the build plan (spec §9). All previous steps are merged into `main`; do not redo them.

First, write the plan to `docs/plans/step-$ARGUMENTS-<slug>.md`: files to create or modify, exact content of any new migration, environment variables needed, the acceptance criterion from spec §9, and open questions for me. Write no implementation code until I approve the plan.

Once approved: work on branch `step-$ARGUMENTS-<slug>`, atomic commits. `npm run lint`, `npm run typecheck` and `npm test` must pass. Finish by pushing the branch and reporting the Cloudflare preview URL, any Cloudflare environment variables to add, and an updated `docs/handoff.md`.