-- Tests for profile_attributions (20261009100000_profile_attributions.sql):
-- server-side validation of client-supplied attribution, the "direct"
-- default, immutability and privacy. Run with `npx supabase test db`.
-- UUID range dddddddd-....
begin;
select plan(15);

create function pg_temp.new_user(n int, meta jsonb) returns void
language sql as $$
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    is_sso_user, is_anonymous, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000',
    ('dddddddd-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'authenticated', 'authenticated',
    'attribution-test-' || n || '@101ameliorations.test', 'x', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, meta,
    false, false, now(), now(), '', '', '', ''
  );
$$;

create function pg_temp.attr(n int) returns public.profile_attributions
language sql as $$
  select * from public.profile_attributions
   where profile_id = ('dddddddd-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;

-- 1: valid first and last touch.
select pg_temp.new_user(1, jsonb_build_object('attribution', jsonb_build_object(
  'first_seen_at', '2026-10-01T08:00:00Z',
  'first_touch', jsonb_build_object('source','cpam','medium','print',
     'campaign','lancement-2026-10','content','papillon-velo','referrer_host','Www.Facebook.com'),
  'last_touch', jsonb_build_object('source','txdo','medium','social',
     'campaign','lancement-2026-10','content','facebook'))));
select is(
  (select row(first_source, first_medium::text, first_campaign, first_content, first_referrer_host,
              last_source, last_medium::text, last_content)::text from pg_temp.attr(1)),
  '(cpam,print,lancement-2026-10,papillon-velo,www.facebook.com,txdo,social,facebook)',
  'valid first and last touch are stored (host lowercased)');

-- 2: no metadata at all.
select pg_temp.new_user(2, '{}'::jsonb);
select is((select first_source || '/' || last_source from pg_temp.attr(2)), 'direct/direct',
  'an account created without attribution is "direct"');

-- 3: invalid values are dropped field by field, never fail the sign-up.
select pg_temp.new_user(3, jsonb_build_object('attribution', jsonb_build_object(
  'first_touch', jsonb_build_object('source','cpam','medium','banner',
     'campaign','Bad Campaign','content', repeat('a', 65), 'referrer_host','evil host/<x>'))));
select is(
  (select row(first_source, first_medium, first_campaign, first_content, first_referrer_host)::text
     from pg_temp.attr(3)),
  '(cpam,,,,)',
  'unknown medium, bad tokens and bad host are dropped, valid source kept');

-- 4: invalid source falls back to direct.
select pg_temp.new_user(4, jsonb_build_object('attribution', jsonb_build_object(
  'first_touch', jsonb_build_object('source','NOT OK','medium','print'))));
select is((select first_source from pg_temp.attr(4)), 'direct', 'invalid source -> direct');

-- 5: referrer only -> referral.
select pg_temp.new_user(5, jsonb_build_object('attribution', jsonb_build_object(
  'first_touch', jsonb_build_object('referrer_host','www.sudouest.fr'))));
select is((select first_source || '|' || first_referrer_host from pg_temp.attr(5)),
  'referral|www.sudouest.fr', 'external referrer without utm -> referral');

-- 6: missing last touch copies the first.
select is((select last_source from pg_temp.attr(1)), 'txdo', 'explicit last touch kept');
select pg_temp.new_user(6, jsonb_build_object('attribution', jsonb_build_object(
  'first_touch', jsonb_build_object('source','cpam','medium','email'))));
select is((select last_source || '/' || last_medium::text from pg_temp.attr(6)), 'cpam/email',
  'a missing last touch defaults to the first');

-- 7: garbage shapes never break the sign-up.
select lives_ok($$ select pg_temp.new_user(7, '{"attribution":"oops"}'::jsonb) $$,
  'a non-object attribution does not break sign-up');
select is((select first_source from pg_temp.attr(7)), 'direct', 'non-object attribution -> direct');
select lives_ok(
  $$ select pg_temp.new_user(8, '{"attribution":{"first_touch":[1,2],"last_touch":42,"first_seen_at":"nope"}}'::jsonb) $$,
  'wrong types do not break sign-up');
select is((select first_source from pg_temp.attr(8)), 'direct', 'wrong types -> direct');

-- 9: first_seen_at is clamped to [now - 2 years, now].
select pg_temp.new_user(9, '{"attribution":{"first_seen_at":"2999-01-01T00:00:00Z"}}'::jsonb);
select ok((select first_seen_at <= now() from pg_temp.attr(9)), 'a future first_seen_at is clamped');
select pg_temp.new_user(10, '{"attribution":{"first_seen_at":"2001-01-01T00:00:00Z"}}'::jsonb);
select ok((select first_seen_at >= now() - interval '2 years 1 minute' from pg_temp.attr(10)),
  'an ancient first_seen_at is clamped');

-- Immutability and privacy.
select throws_ok(
  $$ update public.profile_attributions set first_source = 'txdo'
      where profile_id = 'dddddddd-0000-4000-8000-000000000002' $$,
  'profile attribution is immutable', 'attribution cannot be updated, even by postgres');

select set_config('request.jwt.claims',
  '{"sub":"dddddddd-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select * from public.profile_attributions $$, '42501', null,
  'an account cannot read attributions, not even its own');
reset role;

select * from finish();
rollback;
