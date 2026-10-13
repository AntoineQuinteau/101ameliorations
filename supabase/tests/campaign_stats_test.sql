-- Tests for campaign_stats() (20261009120000_campaign_stats.sql): access
-- control and the scans / sign-ups / installs counts. UUID range eeeeeeee-...
begin;
select plan(13);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  is_sso_user, is_anonymous, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values
  ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-0000-4000-8000-000000000001',
   'authenticated', 'authenticated', 'stats-manager@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-0000-4000-8000-000000000002',
   'authenticated', 'authenticated', 'stats-user@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, false, now(), now(), '', '', '', ''),
  -- Two sign-ups from the cpam-papillon link (first touch), one with an
  -- unconfirmed email (must not count), different last touches.
  ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-0000-4000-8000-000000000003',
   'authenticated', 'authenticated', 'stats-s1@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"attribution":{"first_touch":{"source":"cpam","medium":"print","campaign":"lancement-2026-10","content":"papillon-velo"},"last_touch":{"source":"txdo","medium":"social","campaign":"lancement-2026-10","content":"facebook"}}}'::jsonb,
   false, false, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-0000-4000-8000-000000000004',
   'authenticated', 'authenticated', 'stats-s2@101ameliorations.test', 'x', now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"attribution":{"first_touch":{"source":"cpam","medium":"print","campaign":"lancement-2026-10","content":"papillon-velo"}}}'::jsonb,
   false, false, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-0000-4000-8000-000000000005',
   'authenticated', 'authenticated', 'stats-s3@101ameliorations.test', 'x', null,
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"attribution":{"first_touch":{"source":"cpam","medium":"print","campaign":"lancement-2026-10","content":"papillon-velo"}}}'::jsonb,
   false, false, now(), now(), '', '', '', '');

set local role postgres;
alter table public.profiles disable trigger profiles_guard_role;
update public.profiles set can_manage_campaigns = true
 where id = 'eeeeeeee-0000-4000-8000-000000000001';
alter table public.profiles enable trigger profiles_guard_role;

-- Klashes: s1 (first cpam-papillon, last txdo-facebook) has two counted ones
-- and a rejected and a duplicate one (excluded); s2 has one; s3 (unconfirmed
-- email) has one, which must not count.
insert into public.klashes (id, author_id, location, category, importance, title, status)
select ('eeeeeeee-2222-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, a,
       extensions.st_setsrid(extensions.st_makepoint(-1.47, 43.49), 4326)::extensions.geography,
       'category_1', 'medium', 'Stats klash ' || n, st::public.klash_status
from (values
  (1, 'eeeeeeee-0000-4000-8000-000000000003'::uuid, 'new'),
  (2, 'eeeeeeee-0000-4000-8000-000000000003'::uuid, 'resolved'),
  (3, 'eeeeeeee-0000-4000-8000-000000000003'::uuid, 'rejected'),
  (4, 'eeeeeeee-0000-4000-8000-000000000003'::uuid, 'duplicate'),
  (5, 'eeeeeeee-0000-4000-8000-000000000004'::uuid, 'new'),
  (6, 'eeeeeeee-0000-4000-8000-000000000005'::uuid, 'new')
) as v (n, a, st);

reset role;

-- Two scans, one of them on a deactivated link (does not count), three installs.
select public.resolve_campaign_link('cpam-papillon');
select public.resolve_campaign_link('cpam-papillon');
select public.record_install('android',
  '{"source":"cpam","medium":"print","campaign":"lancement-2026-10","content":"papillon-velo"}'::jsonb, null);
select public.record_install('ios',
  '{"source":"cpam","medium":"print","campaign":"lancement-2026-10","content":"papillon-velo"}'::jsonb, null);
select public.record_install('ios', '{"source":"txdo","medium":"social","campaign":"lancement-2026-10","content":"facebook"}'::jsonb, null);
update public.campaign_links set is_active = false where slug = 'cpam-mail';
select public.resolve_campaign_link('cpam-mail');

-- Access control.
set local role anon;
select throws_ok($$ select * from public.campaign_stats() $$, '42501', null,
  'anon cannot read campaign statistics');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select * from public.campaign_stats() $$,
  'only a campaign manager can read campaign statistics',
  'a plain user cannot read campaign statistics');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select throws_ok($$ select * from public.campaign_stats('middle') $$,
  'p_touch must be first or last', 'an unknown attribution mode is rejected');

-- First-touch attribution.
select is(
  (select row(scans, signups, installs)::text from public.campaign_stats('first') where slug = 'cpam-papillon'),
  '(2,2,2)',
  'first touch: 2 scans, 2 confirmed sign-ups (the unconfirmed one is excluded), 2 installs');
select is(
  (select row(scans, signups, installs)::text from public.campaign_stats('first') where slug = 'txdo-facebook'),
  '(0,0,1)', 'first touch: txdo-facebook only has its install');

-- Last-touch attribution moves the first sign-up to txdo-facebook.
select is(
  (select signups from public.campaign_stats('last') where slug = 'txdo-facebook'), 1::bigint,
  'last touch: the sign-up whose last touch is txdo-facebook is counted there');
select is(
  (select signups from public.campaign_stats('last') where slug = 'cpam-papillon'), 1::bigint,
  'last touch: the sign-up without explicit last touch falls back to its first');

-- Klashes: rejected, duplicate and unconfirmed-account ones are not counted.
select is(
  (select klashes from public.campaign_stats('first') where slug = 'cpam-papillon'), 3::bigint,
  'first touch: 3 klashes (rejected, duplicate and unconfirmed-account ones excluded)');
select is(
  (select klashes from public.campaign_stats('first') where slug = 'txdo-facebook'), 0::bigint,
  'first touch: a link whose channel brought no author has 0 klashes');
select is(
  (select klashes from public.campaign_stats('last') where slug = 'txdo-facebook'), 2::bigint,
  'last touch: the klashes follow the author''s last channel');
select is(
  (select klashes from public.campaign_stats('last') where slug = 'cpam-papillon'), 1::bigint,
  'last touch: the author without explicit last touch falls back to the first');

-- A deactivated link keeps showing, with no counted scan.
select is(
  (select scans from public.campaign_stats('first') where slug = 'cpam-mail'), 0::bigint,
  'a pass on a deactivated link is not a scan');

-- Attributions without a link still appear, so the summary adds up.
select ok(
  exists (select 1 from public.campaign_stats('first') where slug is null and source = 'direct'),
  'direct sign-ups appear as a row without slug');

select * from finish();
rollback;
