-- RLS + trigger tests for klash creation (step 4). Run with `npx supabase test db`.
--
-- Self-contained: creates its own auth.users fixtures inside this
-- transaction, so it also passes against a database reset with `--no-seed`
-- (as CI does). Uses a UUID range disjoint from the seed's 10000000-... range
-- and the existing profiles_rls_test.sql's aaaaaaaa-... range.
begin;
select plan(16);

-- Three fixture users: one author, one confirmer, one dedicated to the
-- duplicate-prevention tests (10-14) — the author is deliberately run into
-- the rate limit by test 3's loop, so those tests need their own user to
-- reach the duplicate trigger instead of failing on the rate limit first.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  is_sso_user, is_anonymous, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values
  ('00000000-0000-0000-0000-000000000000',
   'bbbbbbbb-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'klash-test-author@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   'bbbbbbbb-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'klash-test-confirmer@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   'bbbbbbbb-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'klash-test-duplicate@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', '');

select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

-- 1. A point inside the service area bbox (43.25-43.80, -1.80--0.90) is accepted.
select lives_ok(
  $$ select public.create_klash(
       43.49, -1.47, 'category_1', 'medium', 'Nid de poule test', null
     ) $$,
  'a klash inside the service area is accepted'
);

-- 2. A point outside the bbox is rejected.
select throws_ok(
  $$ select public.create_klash(
       48.85, 2.35, 'category_1', 'medium', 'Klash hors zone', null
     ) $$,
  'location outside service area',
  'a klash outside the service area is rejected'
);

-- 3. The rate limit blocks the 251st klash in 24h for the same author (1
-- already created in test 1, so 249 more reach the limit without asserting
-- on each one individually, then the 251st is rejected).
do $$
begin
  for i in 2..250 loop
    perform public.create_klash(
      43.49, -1.47, 'category_1', 'medium', 'Klash rate limit ' || i, null
    );
  end loop;
end;
$$;

select throws_ok(
  $$ select public.create_klash(
       43.49, -1.47, 'category_1', 'medium', 'Klash au dela de la limite', null
     ) $$,
  'rate limit exceeded: max 250 klashes per 24h',
  'the 251st klash in 24h is rejected by the rate limit'
);

-- 4. klashes_nearby finds a klash close to a given point.
select isnt_empty(
  $$ select * from public.klashes_nearby(43.49, -1.47, 50) $$,
  'klashes_nearby finds a klash near the given point'
);

-- 5. klashes_nearby does not return a klash far from the given point.
-- Biarritz (43.49,-1.47) vs. a point far south in the service area (43.26,-1.0).
select is_empty(
  format(
    $$ select id from public.klashes_nearby(43.26, -1.0, 50)
       where id in (select id from public.klashes where author_id = '%s') $$,
    'bbbbbbbb-0000-4000-8000-000000000001'
  ),
  'klashes_nearby excludes a klash far from the given point'
);

-- 6. klashes_nearby excludes a klash resolved more than 30 days ago. Since
-- step 7, a direct `status` UPDATE is rejected by
-- klashes_enforce_status_transition regardless of role (it isn't an RLS
-- check, so running as postgres alone doesn't bypass it) unless it comes
-- through change_klash_status() — irrelevant to what this test exercises
-- (klashes_nearby's own filter), so this fixture setup disables the trigger
-- for one statement, the same pattern profiles_guard_role fixtures use.
set local role postgres;
alter table public.klashes disable trigger klashes_enforce_status_transition;
update public.klashes
   set status = 'resolved', resolved_at = now() - interval '31 days'
 where author_id = 'bbbbbbbb-0000-4000-8000-000000000001'
   and title = 'Nid de poule test';
alter table public.klashes enable trigger klashes_enforce_status_transition;
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is_empty(
  $$ select id from public.klashes_nearby(43.49, -1.47, 50)
     where title = 'Nid de poule test' $$,
  'klashes_nearby excludes a klash resolved more than 30 days ago'
);

-- 7. An author cannot confirm their own klash (confirmations_insert_self,
-- already enforced by an existing policy — covered here, not reimplemented).
select throws_ok(
  format(
    $$ insert into public.confirmations (klash_id, user_id)
       select id, 'bbbbbbbb-0000-4000-8000-000000000001'
         from public.klashes
        where author_id = 'bbbbbbbb-0000-4000-8000-000000000001'
        limit 1 $$
  ),
  'new row violates row-level security policy for table "confirmations"',
  'an author cannot confirm their own klash'
);

-- 8. A non-author can confirm someone else's klash.
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  format(
    $$ insert into public.confirmations (klash_id, user_id)
       select id, 'bbbbbbbb-0000-4000-8000-000000000002'
         from public.klashes
        where author_id = 'bbbbbbbb-0000-4000-8000-000000000001'
          and title = 'Nid de poule test'
        limit 1 $$
  ),
  'a non-author can confirm a klash'
);

-- 9. confirmations_count is actually incremented by that confirm — this is
-- the regression test for refresh_confirmations_count() needing security
-- definer: the trigger's own `update klashes` runs under RLS as the
-- confirming (non-author) user, who has no UPDATE policy on someone else's
-- klash, so before the fix this silently stayed at 0.
select is(
  (select confirmations_count from public.klashes
    where author_id = 'bbbbbbbb-0000-4000-8000-000000000001'
      and title = 'Nid de poule test'),
  1,
  'confirmations_count is incremented after a non-author confirms'
);

-- 10-11. A double-submitted create_klash call (same author, title, category,
-- position) is rejected the second time — the server-side backstop for the
-- client-side double-submit fixes (submitGuard.ts, one caller in
-- NewKlashPage, a disabled submit button), all of which are bypassable.
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$ select public.create_klash(
       43.30, -1.75, 'category_2', 'high', 'Nid de poule doublon', null
     ) $$,
  'the first of two identical submits is accepted'
);

select throws_ok(
  $$ select public.create_klash(
       43.30, -1.75, 'category_2', 'high', 'Nid de poule doublon', null
     ) $$,
  'duplicate klash: an identical klash was created less than 60 seconds ago',
  'an identical submit within 60 seconds is rejected'
);

-- 12. Same position and title but a different category is a different
-- report, not a duplicate — the guard only blocks exact repeats.
select lives_ok(
  $$ select public.create_klash(
       43.30, -1.75, 'category_3', 'high', 'Nid de poule doublon', null
     ) $$,
  'the same title and position but a different category is accepted'
);

-- 13. A tiny GPS jitter (~3cm, well under the 0.1m threshold) between two
-- otherwise-identical submits still counts as the same position.
select throws_ok(
  $$ select public.create_klash(
       43.3000003, -1.75, 'category_2', 'high', 'Nid de poule doublon', null
     ) $$,
  'duplicate klash: an identical klash was created less than 60 seconds ago',
  'a sub-metre GPS jitter does not escape the duplicate guard'
);

-- 14. A genuinely different position (well beyond the duplicate-detection
-- radius) is accepted even with the same author/title/category.
select lives_ok(
  $$ select public.create_klash(
       43.60, -1.20, 'category_2', 'high', 'Nid de poule doublon', null
     ) $$,
  'the same title and category at a different position is accepted'
);

-- 15. 'category_7' ("Autre") without a category_other precision is rejected
-- by klashes_category_other_required_check.
select throws_ok(
  $$ select public.create_klash(
       43.55, -1.10, 'category_7', 'medium', 'Klash autre sans precision', null
     ) $$,
  'new row for relation "klashes" violates check constraint "klashes_category_other_required_check"',
  'category_7 without a category_other precision is rejected'
);

-- 16. A non-'category_7' category with a category_other precision is
-- rejected by the same constraint, the other way round.
select throws_ok(
  $$ select public.create_klash(
       43.56, -1.11, 'category_1', 'medium', 'Klash avec precision indue', null,
       'Précision qui ne devrait pas être là'
     ) $$,
  'new row for relation "klashes" violates check constraint "klashes_category_other_required_check"',
  'a non-category_7 category with a category_other precision is rejected'
);

select * from finish();
rollback;
