-- RLS + trigger tests for klash creation (step 4). Run with `npx supabase test db`.
--
-- Self-contained: creates its own auth.users fixtures inside this
-- transaction, so it also passes against a database reset with `--no-seed`
-- (as CI does). Uses a UUID range disjoint from the seed's 10000000-... range
-- and the existing profiles_rls_test.sql's aaaaaaaa-... range.
begin;
select plan(9);

-- Two fixture users: one author, one confirmer.
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

-- 3. The rate limit blocks the 11th klash in 24h for the same author (1
-- already created in test 1, so 9 more reach the limit without asserting on
-- each one individually, then the 11th is rejected).
do $$
begin
  for i in 2..10 loop
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
  'rate limit exceeded: max 10 klashes per 24h',
  'the 11th klash in 24h is rejected by the rate limit'
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

-- 6. klashes_nearby excludes a klash resolved more than 30 days ago.
update public.klashes
   set status = 'resolved', resolved_at = now() - interval '31 days'
 where author_id = 'bbbbbbbb-0000-4000-8000-000000000001'
   and title = 'Nid de poule test';

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

select * from finish();
rollback;
