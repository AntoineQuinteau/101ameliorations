-- The campaign medium list has a single source of truth, the
-- public.campaign_medium enum (20261020120000_attribution_medium_from_enum.sql).
-- These checks fail if a hand-written copy of the list creeps back into
-- sanitize_attribution_touch. Run with `npx supabase test db`.
begin;
select plan(4);

-- 1: every value of the enum survives sanitization, in enum order.
select is(
  (select array_agg(m order by ord)
     from (
       select e as ord, e::text as m, (public.sanitize_attribution_touch(
         jsonb_build_object('source', 'cpam', 'medium', e::text))).medium::text as kept
         from unnest(enum_range(null::public.campaign_medium)) e
     ) s
    where kept = m),
  (select array_agg(e::text order by e) from unnest(enum_range(null::public.campaign_medium)) e),
  'every campaign_medium value is accepted by sanitize_attribution_touch');

-- 2: a value outside the enum is dropped.
select is(
  (select medium::text from public.sanitize_attribution_touch(
     '{"source":"cpam","medium":"banner"}'::jsonb)),
  null, 'an unknown medium is dropped');

-- 3: a non-string medium is dropped.
select is(
  (select medium::text from public.sanitize_attribution_touch(
     '{"source":"cpam","medium":5}'::jsonb)),
  null, 'a non-string medium is dropped');

-- 4: the function must stay stable: enum_range() is stable, so declaring it
-- immutable again would let the planner freeze the enum values.
select is(
  (select provolatile::text from pg_proc
    where oid = 'public.sanitize_attribution_touch(jsonb)'::regprocedure),
  's', 'sanitize_attribution_touch is stable');

select * from finish();
rollback;
