# 101améliorations — project conventions for Claude Code

## What this is
A PWA for reporting cycling-infrastructure issues ("klashs") in the Basque Country and southern Landes (CAPB + sud Landes). Full specification: `docs/spec.md`. Read it entirely before any work. It is the source of truth; if code and spec disagree, ask before deviating.

## Language rules
- All code, identifiers, SQL, comments, commit messages and file names are in **English**.
- All user-facing text is in **French**, and lives only in `src/i18n/fr.ts`. Never hardcode French strings in components.

## Stack (do not substitute)
React 18 + Vite + TypeScript (strict) + Tailwind, react-router, TanStack Query, zod, react-leaflet + leaflet.markercluster, MapTiler tiles, `@supabase/supabase-js`, vite-plugin-pwa, `browser-image-compression`, `exifr`. Backend: Supabase (Postgres + PostGIS, Auth email OTP, Storage, RLS). No custom server. Hosting: Cloudflare Pages via GitHub.

## Workflow
- Follow the build plan in spec §9, one step per session. Do not start the next step before the current one meets its acceptance criterion and is deployed as a preview.
- Every schema change is a new file in `supabase/migrations/`. Never edit an applied migration. Run `supabase db reset` locally after each migration, then `supabase gen types typescript --local > src/types/database.ts`.
- RLS is enabled on every table from the first migration. Write the policy in the same migration as the table.
- Secrets never go in the repo. Use `.env.local` (git-ignored) and `.env.example` (committed, empty values).
- Small, focused commits with conventional messages (`feat:`, `fix:`, `chore:`, `db:`). Push to a feature branch; the human merges to `main`.
- Before claiming a step is done: `npm run lint`, `npm run typecheck`, `npm test` all pass, and the preview URL is listed in the final message.

## Definition of done for the whole v1
Spec §9 steps 1–9 complete, tested on a real phone by the human, and RLS tests in `supabase/tests/` cover every forbidden action from the permissions table in spec §2.
