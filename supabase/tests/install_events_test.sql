-- Tests for record_install() / install_events
-- (20261009110000_install_events.sql). Run with `npx supabase test db`.
begin;
select plan(8);

set local role anon;
select lives_ok(
  $$ select public.record_install('ios',
       '{"source":"cpam","medium":"print","campaign":"lancement-2026-10","content":"papillon-velo"}'::jsonb,
       '{"source":"txdo","medium":"social","campaign":"lancement-2026-10","content":"facebook"}'::jsonb) $$,
  'anon can record an install');
select throws_ok($$ select * from public.install_events $$, '42501', null,
  'anon cannot read install_events');
reset role;

select is(
  (select row(platform, first_source, first_medium::text, first_content, last_source)::text
     from public.install_events order by id desc limit 1),
  '(ios,cpam,print,papillon-velo,txdo)',
  'the install is stored with first and last touch');

select public.record_install('toaster', '{"source":"BAD SOURCE","medium":"banner"}'::jsonb, null);
select is(
  (select row(platform, first_source, first_medium, first_campaign)::text
     from public.install_events order by id desc limit 1),
  '(other,direct,,)',
  'unknown platform -> other, invalid values -> direct');

select public.record_install('android', null, null);
select is((select first_source || '/' || last_source from public.install_events order by id desc limit 1),
  'direct/direct', 'no attribution -> direct');

select public.record_install('desktop', '{"referrer_host":"www.sudouest.fr"}'::jsonb, null);
select is((select first_source from public.install_events order by id desc limit 1),
  'referral', 'referrer-only touch -> referral');

select public.record_install('android', '"not an object"'::jsonb, '[1]'::jsonb);
select is((select first_source from public.install_events order by id desc limit 1),
  'direct', 'garbage shapes -> direct');

select ok(
  has_function_privilege('anon', 'public.record_install(text, jsonb, jsonb)', 'EXECUTE'),
  'record_install is callable without an account');

select * from finish();
rollback;
