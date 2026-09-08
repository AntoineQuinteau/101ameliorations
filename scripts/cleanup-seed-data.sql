-- Removes every row created by supabase/seed.sql from a database (typically
-- production), ahead of opening the app to the public. Safe to run any time
-- before real users exist: it only touches the fixed seed-user ids below.
--
-- Usage: npx supabase db query --linked -f scripts/cleanup-seed-data.sql

begin;

create temporary table seed_user_ids (id uuid primary key);
insert into seed_user_ids (id) values
  ('10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000003'),
  ('10000000-0000-4000-8000-000000000004'),
  ('10000000-0000-4000-8000-000000000005'),
  ('10000000-0000-4000-8000-000000000006'),
  ('10000000-0000-4000-8000-000000000007'),
  ('10000000-0000-4000-8000-000000000008'),
  ('10000000-0000-4000-8000-000000000009'),
  ('10000000-0000-4000-8000-000000000010'),
  ('10000000-0000-4000-8000-000000000011'),
  ('10000000-0000-4000-8000-000000000012');

update public.klashes set duplicate_of = null
 where author_id in (select id from seed_user_ids);
delete from public.confirmations
 where user_id in (select id from seed_user_ids)
    or klash_id in (select id from public.klashes where author_id in (select id from seed_user_ids));
delete from public.klashes where author_id in (select id from seed_user_ids);
delete from auth.users where id in (select id from seed_user_ids); -- cascades profiles

drop table seed_user_ids;

commit;
