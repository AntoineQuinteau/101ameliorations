-- RLS + trigger tests for the klash lifecycle (step 7). Run with
-- `npx supabase test db`.
--
-- Self-contained: creates its own auth.users and klashes fixtures inside
-- this transaction, so it also passes against a database reset with
-- `--no-seed` (as CI does). Uses a UUID range disjoint from the seed's
-- 10000000-... range and the aaaaaaaa-.../bbbbbbbb-.../cccccccc-.../
-- dddddddd-... ranges from earlier steps.
--
-- throws_ok vs is(...) — verified against Postgres directly before writing
-- these tests (not assumed): a BEFORE trigger's raise fires and aborts the
-- statement *before* WITH CHECK is evaluated, so any rejection that goes
-- through a trigger (enforce_status_transition, guard_klash_authority_
-- columns, or change_klash_status itself) is throws_ok. WITH CHECK failing
-- on its own (no trigger in the way) also raises — "new row violates
-- row-level security policy" — it is not a silent no-op either. The only
-- silent no-op is a plain UPDATE whose USING clause matches no row at all,
-- which is asserted with is(...) on the unchanged value (same idiom as
-- profiles_rls_test.sql and comments_rls_test.sql).
begin;
select plan(62);

-- Four fixture users: a klash author (plain 'user'), a moderator, an
-- authority, and an admin. Roles set directly as postgres with
-- profiles_guard_role disabled, since that trigger reads current_user_role()
-- (auth.uid() from the JWT claim, not the Postgres session role) — the same
-- pattern used by every other pgTAP fixture in this directory.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  is_sso_user, is_anonymous, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values
  ('00000000-0000-0000-0000-000000000000',
   'eeeeeeee-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'lifecycle-test-author@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   'eeeeeeee-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'lifecycle-test-moderator@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   'eeeeeeee-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'lifecycle-test-authority@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   'eeeeeeee-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
   'lifecycle-test-admin@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   'eeeeeeee-0000-4000-8000-000000000005', 'authenticated', 'authenticated',
   'lifecycle-test-other-user@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', '');

set local role postgres;
alter table public.profiles disable trigger profiles_guard_role;
update public.profiles set role = 'moderator'
 where id = 'eeeeeeee-0000-4000-8000-000000000002';
update public.profiles set role = 'authority'
 where id = 'eeeeeeee-0000-4000-8000-000000000003';
update public.profiles set role = 'admin'
 where id = 'eeeeeeee-0000-4000-8000-000000000004';
alter table public.profiles enable trigger profiles_guard_role;

-- One klash per starting status, plus spares consumed by tests that
-- successfully transition their klash (a klash that has moved on can't be
-- reused for a second "from this status" test).
insert into public.klashes (id, author_id, location, category, urgency, title, status)
values
  ('eeeeeeee-1111-4000-8000-000000000001', 'eeeeeeee-0000-4000-8000-000000000001',
   extensions.st_setsrid(extensions.st_makepoint(-1.47, 43.49), 4326)::extensions.geography,
   'category_1', 'medium', 'Lifecycle klash 01 - new', 'new'),
  ('eeeeeeee-1111-4000-8000-000000000002', 'eeeeeeee-0000-4000-8000-000000000001',
   extensions.st_setsrid(extensions.st_makepoint(-1.47, 43.49), 4326)::extensions.geography,
   'category_1', 'medium', 'Lifecycle klash 02 - new (author tests)', 'new'),
  ('eeeeeeee-1111-4000-8000-000000000003', 'eeeeeeee-0000-4000-8000-000000000001',
   extensions.st_setsrid(extensions.st_makepoint(-1.47, 43.49), 4326)::extensions.geography,
   'category_1', 'medium', 'Lifecycle klash 03 - acknowledged', 'acknowledged'),
  ('eeeeeeee-1111-4000-8000-000000000004', 'eeeeeeee-0000-4000-8000-000000000001',
   extensions.st_setsrid(extensions.st_makepoint(-1.47, 43.49), 4326)::extensions.geography,
   'category_1', 'medium', 'Lifecycle klash 04 - in_progress', 'in_progress'),
  ('eeeeeeee-1111-4000-8000-000000000005', 'eeeeeeee-0000-4000-8000-000000000001',
   extensions.st_setsrid(extensions.st_makepoint(-1.47, 43.49), 4326)::extensions.geography,
   'category_1', 'medium', 'Lifecycle klash 05 - resolved', 'resolved'),
  ('eeeeeeee-1111-4000-8000-000000000006', 'eeeeeeee-0000-4000-8000-000000000001',
   extensions.st_setsrid(extensions.st_makepoint(-1.47, 43.49), 4326)::extensions.geography,
   'category_1', 'medium', 'Lifecycle klash 06 - rejected', 'rejected'),
  ('eeeeeeee-1111-4000-8000-000000000007', 'eeeeeeee-0000-4000-8000-000000000001',
   extensions.st_setsrid(extensions.st_makepoint(-1.47, 43.49), 4326)::extensions.geography,
   'category_1', 'medium', 'Lifecycle klash 07 - duplicate', 'duplicate'),
  ('eeeeeeee-1111-4000-8000-000000000008', 'eeeeeeee-0000-4000-8000-000000000001',
   extensions.st_setsrid(extensions.st_makepoint(-1.47, 43.49), 4326)::extensions.geography,
   'category_1', 'medium', 'Lifecycle klash 08 - new (spares 1)', 'new'),
  ('eeeeeeee-1111-4000-8000-000000000009', 'eeeeeeee-0000-4000-8000-000000000001',
   extensions.st_setsrid(extensions.st_makepoint(-1.47, 43.49), 4326)::extensions.geography,
   'category_1', 'medium', 'Lifecycle klash 09 - rejected (spares 2)', 'rejected'),
  ('eeeeeeee-1111-4000-8000-000000000010', 'eeeeeeee-0000-4000-8000-000000000001',
   extensions.st_setsrid(extensions.st_makepoint(-1.47, 43.49), 4326)::extensions.geography,
   'category_1', 'medium', 'Lifecycle klash 10 - duplicate (spares 3)', 'duplicate'),
  ('eeeeeeee-1111-4000-8000-000000000011', 'eeeeeeee-0000-4000-8000-000000000001',
   extensions.st_setsrid(extensions.st_makepoint(-1.47, 43.49), 4326)::extensions.geography,
   'category_1', 'medium', 'Lifecycle klash 11 - acknowledged (spares 4)', 'acknowledged'),
  ('eeeeeeee-1111-4000-8000-000000000012', 'eeeeeeee-0000-4000-8000-000000000001',
   extensions.st_setsrid(extensions.st_makepoint(-1.47, 43.49), 4326)::extensions.geography,
   'category_1', 'medium', 'Lifecycle klash 12 - in_progress (spares 5)', 'in_progress'),
  ('eeeeeeee-1111-4000-8000-000000000013', 'eeeeeeee-0000-4000-8000-000000000001',
   extensions.st_setsrid(extensions.st_makepoint(-1.47, 43.49), 4326)::extensions.geography,
   'category_1', 'medium', 'Lifecycle klash 13 - resolved (spares 6)', 'resolved'),
  ('eeeeeeee-1111-4000-8000-000000000014', 'eeeeeeee-0000-4000-8000-000000000001',
   extensions.st_setsrid(extensions.st_makepoint(-1.47, 43.49), 4326)::extensions.geography,
   'category_1', 'medium', 'Lifecycle klash 14 - new (admin spare)', 'new'),
  ('eeeeeeee-1111-4000-8000-000000000015', 'eeeeeeee-0000-4000-8000-000000000001',
   extensions.st_setsrid(extensions.st_makepoint(-1.47, 43.49), 4326)::extensions.geography,
   'category_1', 'medium', 'Lifecycle klash 15 - rejected (admin spare)', 'rejected'),
  ('eeeeeeee-1111-4000-8000-000000000016', 'eeeeeeee-0000-4000-8000-000000000001',
   extensions.st_setsrid(extensions.st_makepoint(-1.47, 43.49), 4326)::extensions.geography,
   'category_1', 'medium', 'Lifecycle klash 16 - new (RPC hardening)', 'new'),
  ('eeeeeeee-1111-4000-8000-000000000017', 'eeeeeeee-0000-4000-8000-000000000001',
   extensions.st_setsrid(extensions.st_makepoint(-1.47, 43.49), 4326)::extensions.geography,
   'category_1', 'medium', 'Lifecycle klash 17 - new (bypass tests)', 'new'),
  ('eeeeeeee-1111-4000-8000-000000000018', 'eeeeeeee-0000-4000-8000-000000000001',
   extensions.st_setsrid(extensions.st_makepoint(-1.47, 43.49), 4326)::extensions.geography,
   'category_1', 'medium', 'Lifecycle klash 18 - new (authority bypass)', 'new'),
  ('eeeeeeee-1111-4000-8000-000000000019', 'eeeeeeee-0000-4000-8000-000000000005',
   extensions.st_setsrid(extensions.st_makepoint(-1.47, 43.49), 4326)::extensions.geography,
   'category_1', 'medium', 'Lifecycle klash 19 - new (other author; column guard target)', 'new');
reset role;

-- ========================================================================
-- A. Allowed arrows (spec §3 graph) — lives_ok
-- ========================================================================

select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

-- 1. moderator: new -> rejected
select lives_ok(
  $$ select change_klash_status('eeeeeeee-1111-4000-8000-000000000001', 'rejected', 'Hors perimetre') $$,
  '1. moderator can move a klash from new to rejected'
);

-- 2. moderator: new -> duplicate
select lives_ok(
  $$ select change_klash_status('eeeeeeee-1111-4000-8000-000000000008', 'duplicate', null) $$,
  '2. moderator can move a klash from new to duplicate'
);

-- 3. moderator: rejected -> new
select lives_ok(
  $$ select change_klash_status('eeeeeeee-1111-4000-8000-000000000009', 'new', 'Erreur de tri') $$,
  '3. moderator can move a klash from rejected back to new'
);

-- 4. moderator: duplicate -> new
select lives_ok(
  $$ select change_klash_status('eeeeeeee-1111-4000-8000-000000000010', 'new', null) $$,
  '4. moderator can move a klash from duplicate back to new'
);

select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;

-- 5. authority: new -> acknowledged
select lives_ok(
  $$ select change_klash_status('eeeeeeee-1111-4000-8000-000000000002', 'acknowledged', 'Pris en compte') $$,
  '5. authority can move a klash from new to acknowledged'
);

-- 6. authority: acknowledged -> in_progress
select lives_ok(
  $$ select change_klash_status('eeeeeeee-1111-4000-8000-000000000003', 'in_progress', null) $$,
  '6. authority can move a klash from acknowledged to in_progress'
);

-- 7. authority: in_progress -> resolved
select lives_ok(
  $$ select change_klash_status('eeeeeeee-1111-4000-8000-000000000004', 'resolved', 'Travaux termines') $$,
  '7. authority can move a klash from in_progress to resolved'
);

-- 8. authority: resolved -> in_progress (reopening)
select lives_ok(
  $$ select change_klash_status('eeeeeeee-1111-4000-8000-000000000005', 'in_progress', 'Reouverture') $$,
  '8. authority can reopen a resolved klash back to in_progress'
);

select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-4000-8000-000000000004","role":"authenticated"}', true);
set local role authenticated;

-- 9. admin: new -> rejected (moderator half of the union)
select lives_ok(
  $$ select change_klash_status('eeeeeeee-1111-4000-8000-000000000015', 'new', null) $$,
  '9. admin can perform a moderator-side transition (rejected back to new)'
);

-- 10. admin: new -> acknowledged (authority half of the union)
select lives_ok(
  $$ select change_klash_status('eeeeeeee-1111-4000-8000-000000000014', 'acknowledged', null) $$,
  '10. admin can perform an authority-side transition (new to acknowledged)'
);

-- ========================================================================
-- B. History and side effects
-- ========================================================================

-- 11. a status_changes row was written with the right from/to/changed_by/note
select is(
  (select row(from_status, to_status, changed_by, note)
     from public.status_changes
    where klash_id = 'eeeeeeee-1111-4000-8000-000000000001')::text,
  row('new'::public.klash_status, 'rejected'::public.klash_status,
      'eeeeeeee-0000-4000-8000-000000000002'::uuid, 'Hors perimetre')::text,
  '11. status_changes records from_status, to_status, changed_by and note'
);

-- 12. a whitespace-only note is stored as null
select is(
  (select note from public.status_changes
    where klash_id = 'eeeeeeee-1111-4000-8000-000000000008'),
  null,
  '12. a null note is stored as null'
);

-- 13. resolved_at is set after in_progress -> resolved
select isnt(
  (select resolved_at from public.klashes
    where id = 'eeeeeeee-1111-4000-8000-000000000004'),
  null,
  '13. resolved_at is set when a klash reaches resolved'
);

-- 14. resolved_at is cleared after reopening (protects klashes_in_bbox /
-- klashes_nearby from a resolved-looking klash with a null resolved_at)
select is(
  (select resolved_at from public.klashes
    where id = 'eeeeeeee-1111-4000-8000-000000000005'),
  null,
  '14. resolved_at is cleared when a resolved klash is reopened'
);

-- 15. exactly one status_changes row exists per successful transition so far
select is(
  (select count(*)::int from public.status_changes
    where klash_id in (
      'eeeeeeee-1111-4000-8000-000000000001', 'eeeeeeee-1111-4000-8000-000000000002',
      'eeeeeeee-1111-4000-8000-000000000003', 'eeeeeeee-1111-4000-8000-000000000004',
      'eeeeeeee-1111-4000-8000-000000000005', 'eeeeeeee-1111-4000-8000-000000000008',
      'eeeeeeee-1111-4000-8000-000000000009', 'eeeeeeee-1111-4000-8000-000000000010',
      'eeeeeeee-1111-4000-8000-000000000014', 'eeeeeeee-1111-4000-8000-000000000015'
    )),
  10,
  '15. one status_changes row per successful transition, no double insert'
);

-- ========================================================================
-- C. Forbidden arrows, role by role — throws_ok
-- ========================================================================

select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

-- 16-20. moderator may only sort (new<->rejected/duplicate); the processing
-- pipeline and any arrow absent from the graph are all forbidden.
select throws_ok(
  $$ select change_klash_status('eeeeeeee-1111-4000-8000-000000000011', 'in_progress', null) $$,
  'role moderator cannot change a klash status from acknowledged to in_progress',
  '16. moderator cannot move a klash from acknowledged to in_progress'
);
select throws_ok(
  $$ select change_klash_status('eeeeeeee-1111-4000-8000-000000000012', 'resolved', null) $$,
  'role moderator cannot change a klash status from in_progress to resolved',
  '17. moderator cannot move a klash from in_progress to resolved'
);
select throws_ok(
  $$ select change_klash_status('eeeeeeee-1111-4000-8000-000000000013', 'in_progress', null) $$,
  'role moderator cannot change a klash status from resolved to in_progress',
  '18. moderator cannot reopen a resolved klash'
);
select throws_ok(
  $$ select change_klash_status('eeeeeeee-1111-4000-8000-000000000011', 'acknowledged', null) $$,
  'role moderator cannot change a klash status from acknowledged to acknowledged',
  '19. moderator cannot no-op a status onto itself via the RPC'
);
select throws_ok(
  $$ select change_klash_status('eeeeeeee-1111-4000-8000-000000000006', 'duplicate', null) $$,
  'role moderator cannot change a klash status from rejected to duplicate',
  '20. moderator cannot move a klash from rejected to duplicate (no such arrow)'
);

select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;

-- 21-28. authority may only run the processing pipeline forward or reopen;
-- sorting, skipping steps, and returning to new are all forbidden.
select throws_ok(
  $$ select change_klash_status('eeeeeeee-1111-4000-8000-000000000006', 'new', null) $$,
  'role authority cannot change a klash status from rejected to new',
  '21. authority cannot un-reject a klash'
);
select throws_ok(
  $$ select change_klash_status('eeeeeeee-1111-4000-8000-000000000007', 'new', null) $$,
  'role authority cannot change a klash status from duplicate to new',
  '22. authority cannot un-duplicate a klash'
);
select throws_ok(
  $$ select change_klash_status('eeeeeeee-1111-4000-8000-000000000016', 'in_progress', null) $$,
  'role authority cannot change a klash status from new to in_progress',
  '23. authority cannot skip acknowledged (new to in_progress)'
);
select throws_ok(
  $$ select change_klash_status('eeeeeeee-1111-4000-8000-000000000016', 'resolved', null) $$,
  'role authority cannot change a klash status from new to resolved',
  '24. authority cannot skip straight from new to resolved'
);
select throws_ok(
  $$ select change_klash_status('eeeeeeee-1111-4000-8000-000000000011', 'resolved', null) $$,
  'role authority cannot change a klash status from acknowledged to resolved',
  '25. authority cannot skip in_progress (acknowledged to resolved)'
);
select throws_ok(
  $$ select change_klash_status('eeeeeeee-1111-4000-8000-000000000013', 'new', null) $$,
  'role authority cannot change a klash status from resolved to new',
  '26. authority cannot send a resolved klash back to new'
);
select throws_ok(
  $$ select change_klash_status('eeeeeeee-1111-4000-8000-000000000006', 'duplicate', null) $$,
  'role authority cannot change a klash status from rejected to duplicate',
  '27. authority cannot sort (rejected to duplicate)'
);
select throws_ok(
  $$ select change_klash_status('eeeeeeee-1111-4000-8000-000000000016', 'rejected', null) $$,
  'role authority cannot change a klash status from new to rejected',
  '28. authority cannot reject a klash (moderator-only)'
);

-- 29-30. a plain user has no status arrows at all, even on their own klash
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$ select change_klash_status('eeeeeeee-1111-4000-8000-000000000017', 'acknowledged', null) $$,
  'role user cannot change a klash status from new to acknowledged',
  '29. a user cannot move their own klash from new to acknowledged'
);
select throws_ok(
  $$ select change_klash_status('eeeeeeee-1111-4000-8000-000000000017', 'rejected', null) $$,
  'role user cannot change a klash status from new to rejected',
  '30. a user cannot move their own klash from new to rejected'
);

-- 31. anonymous cannot call the RPC at all. Blocked at the grant layer
-- (change_klash_status is revoked from anon, matching create_klash's own
-- authenticated-only grant), so this never reaches the function body's own
-- `auth.uid() is null` check -- that check exists for the case of a stolen
-- or malformed JWT (an authenticated role with no sub claim), not for anon.
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select throws_ok(
  $$ select change_klash_status('eeeeeeee-1111-4000-8000-000000000017', 'acknowledged', null) $$,
  'permission denied for function change_klash_status',
  '31. an anonymous visitor cannot call change_klash_status'
);

-- 31b. the function's own `auth.uid() is null` guard: reachable by an
-- `authenticated`-role call whose JWT carries no `sub` claim (a malformed or
-- stripped token), which the grant-layer check in test 31 does not cover.
reset role;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$ select change_klash_status('eeeeeeee-1111-4000-8000-000000000017', 'acknowledged', null) $$,
  'authentication required to change a klash status',
  '31b. an authenticated-role call with no sub claim is rejected by the RPC itself'
);

-- ========================================================================
-- D. Bypassing the RPC — throws_ok / is
--
-- Placed after a successful RPC call earlier in this transaction (test 1)
-- deliberately: if change_klash_status ever stopped resetting app.status_
-- change to 'off' after its own UPDATE, these direct-update tests would
-- start passing the trigger's token check and silently go green on a real
-- hole in the guard.
-- ========================================================================

select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

-- 32. moderator direct UPDATE (USING passes unconditionally for staff, so
-- the trigger is reached and raises before RLS's own WITH CHECK matters).
select throws_ok(
  $$ update public.klashes set status = 'rejected'
      where id = 'eeeeeeee-1111-4000-8000-000000000017' $$,
  'a klash status can only be changed through change_klash_status()',
  '32. a moderator cannot bypass the RPC with a direct UPDATE'
);

select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;

-- 33. authority direct UPDATE, same guard
select throws_ok(
  $$ update public.klashes set status = 'acknowledged'
      where id = 'eeeeeeee-1111-4000-8000-000000000018' $$,
  'a klash status can only be changed through change_klash_status()',
  '33. an authority cannot bypass the RPC with a direct UPDATE'
);

-- 34. neither rejected attempt above created a status_changes row
select is(
  (select count(*)::int from public.status_changes
    where klash_id in ('eeeeeeee-1111-4000-8000-000000000017', 'eeeeeeee-1111-4000-8000-000000000018')),
  0,
  '34. a bypassed status change writes no history row'
);

-- ========================================================================
-- E. The author escape hatch — throws_ok + is
-- ========================================================================

select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

-- 35. author direct UPDATE on their own 'new' klash: the trigger raises
-- before RLS's WITH CHECK is even evaluated (verified: a BEFORE trigger's
-- exception aborts the statement first).
select throws_ok(
  $$ update public.klashes set status = 'resolved'
      where id = 'eeeeeeee-1111-4000-8000-000000000017' $$,
  'a klash status can only be changed through change_klash_status()',
  '35. an author cannot bypass the RPC on their own new klash either'
);

-- 36. isolates the WITH CHECK fix itself: with the transition trigger
-- disabled, the same statement now fails on RLS instead, proving the policy
-- fix (not just the trigger) closes the original hole. Re-enabled right
-- after.
set local role postgres;
alter table public.klashes disable trigger klashes_enforce_status_transition;
reset role;
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$ update public.klashes set status = 'resolved'
      where id = 'eeeeeeee-1111-4000-8000-000000000017' $$,
  'new row violates row-level security policy for table "klashes"',
  '36. with the trigger disabled, WITH CHECK alone still blocks the author''s own escape hatch'
);

set local role postgres;
alter table public.klashes enable trigger klashes_enforce_status_transition;
reset role;

-- 37. the klash's status is unaffected by both attempts above
select is(
  (select status from public.klashes where id = 'eeeeeeee-1111-4000-8000-000000000017'),
  'new'::public.klash_status,
  '37. the klash status is still new after both bypass attempts'
);

select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

-- 38. the fix didn't over-tighten: the author can still edit their own
-- klash's title while it's new.
select lives_ok(
  $$ update public.klashes set title = 'Lifecycle klash 17 - edited by author'
      where id = 'eeeeeeee-1111-4000-8000-000000000017' $$,
  '38. an author can still edit the title of their own new klash'
);

-- 39. a user editing someone else's klash title is a silent 0-row no-op
-- (USING matches no row) rather than an error.
update public.klashes set title = 'Pirate title'
 where id = 'eeeeeeee-1111-4000-8000-000000000019';

select isnt(
  (select title from public.klashes where id = 'eeeeeeee-1111-4000-8000-000000000019'),
  'Pirate title',
  '39. a user cannot edit the title of someone else''s klash (silent no-op)'
);

-- 40. an author can no longer edit their own klash's title once it has left
-- 'new' (spec §2): also a silent no-op via USING, on klash 01 (now rejected).
update public.klashes set title = 'Should not stick'
 where id = 'eeeeeeee-1111-4000-8000-000000000001';

select isnt(
  (select title from public.klashes where id = 'eeeeeeee-1111-4000-8000-000000000001'),
  'Should not stick',
  '40. an author cannot edit their klash''s title once it is no longer new'
);

-- ========================================================================
-- F. Authority column guard — throws_ok / lives_ok
-- ========================================================================

select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;

-- 41-43. an authority may change status only; every other column is guarded.
select throws_ok(
  $$ update public.klashes set title = 'Retitled by authority'
      where id = 'eeeeeeee-1111-4000-8000-000000000019' $$,
  'an authority can only change a klash status',
  '41. an authority cannot change a klash title'
);
select throws_ok(
  $$ update public.klashes set duplicate_of = 'eeeeeeee-1111-4000-8000-000000000019'
      where id = 'eeeeeeee-1111-4000-8000-000000000006' $$,
  'an authority can only change a klash status',
  '42. an authority cannot mark a klash as a duplicate'
);
select throws_ok(
  $$ update public.klashes set urgency = 'high'
      where id = 'eeeeeeee-1111-4000-8000-000000000019' $$,
  'an authority can only change a klash status',
  '43. an authority cannot change a klash urgency'
);

select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

-- 44-45. a moderator legitimately edits any column, including duplicate_of.
select lives_ok(
  $$ update public.klashes set duplicate_of = 'eeeeeeee-1111-4000-8000-000000000019'
      where id = 'eeeeeeee-1111-4000-8000-000000000006' $$,
  '44. a moderator can mark a klash as a duplicate of another'
);
select lives_ok(
  $$ update public.klashes set title = 'Retitled by moderator'
      where id = 'eeeeeeee-1111-4000-8000-000000000019' $$,
  '45. a moderator can edit any klash''s title'
);

-- 46. seed regression: as postgres with no JWT claim, current_user_role()
-- is null, and the guard must be phrased so null is not mistaken for
-- 'authority' (the exact bug this migration's comment warns against).
set local role postgres;
select lives_ok(
  $$ update public.klashes set duplicate_of = null
      where id = 'eeeeeeee-1111-4000-8000-000000000006' $$,
  '46. a postgres/service_role statement with no JWT claim is not blocked by the authority guard'
);
reset role;

-- ========================================================================
-- G. RPC hardening and the pure rule function
-- ========================================================================

select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

-- 47. a non-existent klash is reported clearly rather than silently no-op-ing
select throws_ok(
  $$ select change_klash_status('00000000-0000-4000-8000-000000000000', 'rejected', null) $$,
  'klash 00000000-0000-4000-8000-000000000000 not found',
  '47. change_klash_status on a non-existent klash raises'
);

-- 48. a note over 500 characters is rejected
select throws_ok(
  format(
    $$ select change_klash_status('eeeeeeee-1111-4000-8000-000000000016', 'rejected', '%s') $$,
    repeat('x', 501)
  ),
  'a status note is limited to 500 characters',
  '48. a status note longer than 500 characters is rejected'
);

-- 49. updated_at is bumped by a successful transition (confirms
-- klashes_set_updated_at still runs after the status trigger). now() is
-- frozen for the whole transaction in Postgres, so comparing updated_at to
-- created_at (both would read the same "now") proves nothing here -- the
-- fixture's original created_at is backdated instead, so any trigger-set
-- updated_at is provably later regardless of transaction-local time.
set local role postgres;
update public.klashes set created_at = now() - interval '1 hour'
 where id = 'eeeeeeee-1111-4000-8000-000000000016';
reset role;
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

-- Every prior use of klash 16 was a rejected attempt (tests 23, 24, 28, 48),
-- so this performs one real transition on it first.
select change_klash_status('eeeeeeee-1111-4000-8000-000000000016', 'rejected', null);

select isnt(
  (select updated_at from public.klashes where id = 'eeeeeeee-1111-4000-8000-000000000016'),
  (select created_at from public.klashes where id = 'eeeeeeee-1111-4000-8000-000000000016'),
  '49. updated_at is bumped after change_klash_status (trigger ordering intact)'
);

-- 50. can_change_klash_status is a directly callable, correct pure function
select ok(
  not public.can_change_klash_status('user', 'new', 'acknowledged')
  and public.can_change_klash_status('admin', 'new', 'acknowledged')
  and public.can_change_klash_status('admin', 'new', 'rejected')
  and not public.can_change_klash_status(null, 'new', 'acknowledged'),
  '50. can_change_klash_status matches the spec §3 graph directly'
);

-- ========================================================================
-- H. find_profile_by_email (spec §6.6, admin-only role management RPC)
-- ========================================================================

-- 51. a moderator (non-admin staff) cannot search by email
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$ select * from find_profile_by_email('lifecycle-test-author@101ameliorations.test') $$,
  'only an admin can search for a profile by email',
  '51. a moderator cannot call find_profile_by_email'
);

-- 52. an admin finds the matching profile by email
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-4000-8000-000000000004","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select id from find_profile_by_email('lifecycle-test-author@101ameliorations.test')),
  'eeeeeeee-0000-4000-8000-000000000001'::uuid,
  '52. an admin finds a profile by its exact email'
);

-- 53. an admin gets no rows for an email that doesn't exist
select is_empty(
  $$ select * from find_profile_by_email('nobody-at-all@101ameliorations.test') $$,
  '53. find_profile_by_email returns nothing for an unknown email'
);

-- 54. an anonymous visitor cannot call it at all (blocked at the grant layer)
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select throws_ok(
  $$ select * from find_profile_by_email('lifecycle-test-author@101ameliorations.test') $$,
  'permission denied for function find_profile_by_email',
  '54. an anonymous visitor cannot call find_profile_by_email'
);

-- ========================================================================
-- I. Klash deletion (spec §2). Regression cover for a bug these tests
-- originally missed entirely: nothing here deleted a klash, so an AFTER
-- DELETE trigger added alongside them (delete_klash_photo_objects, since
-- removed) broke deletion for *everyone* without a single test failing.
-- ========================================================================

-- 55. an author can delete their own klash while it is still 'new'
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$ delete from public.klashes where id = 'eeeeeeee-1111-4000-8000-000000000018' $$,
  '55. an author can delete their own new klash'
);

-- 56. the klash is really gone (a DELETE blocked by RLS matches no row and
-- raises nothing, so liveness alone would not prove the row went away)
select is_empty(
  $$ select 1 from public.klashes where id = 'eeeeeeee-1111-4000-8000-000000000018' $$,
  '56. the deleted klash no longer exists'
);

-- 57. a moderator can delete someone else's klash, whatever its status
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$ delete from public.klashes where id = 'eeeeeeee-1111-4000-8000-000000000007' $$,
  '57. a moderator can delete any klash'
);

-- 58. deleting a klash cascades its status history (status_changes has
-- `on delete cascade`), so no orphaned history survives
select is_empty(
  $$ select 1 from public.status_changes
      where klash_id = 'eeeeeeee-1111-4000-8000-000000000007' $$,
  '58. deleting a klash cascades its status_changes rows'
);

-- 59. a plain user cannot delete someone else's klash: RLS matches no row,
-- so this is a silent no-op asserted on the row still being there
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-4000-8000-000000000005","role":"authenticated"}', true);
set local role authenticated;

delete from public.klashes where id = 'eeeeeeee-1111-4000-8000-000000000012';

select isnt_empty(
  $$ select 1 from public.klashes where id = 'eeeeeeee-1111-4000-8000-000000000012' $$,
  '59. a user cannot delete someone else''s klash'
);

-- 60. deleting a klash that another klash points to as its duplicate target
-- succeeds and nulls the pointer, rather than raising a foreign key
-- violation (the FK was switched to `on delete set null` this step)
set local role postgres;
update public.klashes set duplicate_of = 'eeeeeeee-1111-4000-8000-000000000011'
 where id = 'eeeeeeee-1111-4000-8000-000000000010';
reset role;
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$ delete from public.klashes where id = 'eeeeeeee-1111-4000-8000-000000000011' $$,
  '60. deleting a klash referenced as a duplicate target does not raise'
);

select is(
  (select duplicate_of from public.klashes
    where id = 'eeeeeeee-1111-4000-8000-000000000010'),
  null,
  '61. the referencing klash''s duplicate_of is nulled, not left dangling'
);

select * from finish();
rollback;
