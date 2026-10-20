-- Exhaustive matrix of can_change_klash_status() (spec §3): every
-- role x from x to combination of the user_role and klash_status enums is
-- checked, not just a few spot checks. Run with `npx supabase test db`.
--
-- The list between the BEGIN/END markers is also read by
-- src/lib/klashTransitions.test.ts, which checks the UI mirror
-- (src/lib/klashTransitions.ts) against it: edit the list in this file only.
begin;
select plan(1);

create temp table allowed_transitions (
  role        public.user_role,
  from_status public.klash_status,
  to_status   public.klash_status
);

-- BEGIN allowed transitions
insert into allowed_transitions (role, from_status, to_status) values
  ('moderator', 'new',       'rejected'),
  ('moderator', 'new',       'duplicate'),
  ('moderator', 'rejected',  'new'),
  ('moderator', 'duplicate', 'new'),
  ('authority', 'new',          'acknowledged'),
  ('authority', 'acknowledged', 'in_progress'),
  ('authority', 'in_progress',  'resolved'),
  ('authority', 'resolved',     'in_progress'),
  ('admin', 'new',          'rejected'),
  ('admin', 'new',          'duplicate'),
  ('admin', 'rejected',     'new'),
  ('admin', 'duplicate',    'new'),
  ('admin', 'new',          'acknowledged'),
  ('admin', 'acknowledged', 'in_progress'),
  ('admin', 'in_progress',  'resolved'),
  ('admin', 'resolved',     'in_progress');
-- END allowed transitions

select results_eq(
  $$ select r, f, t
       from unnest(enum_range(null::public.user_role)) r,
            unnest(enum_range(null::public.klash_status)) f,
            unnest(enum_range(null::public.klash_status)) t
      where public.can_change_klash_status(r, f, t)
      order by 1, 2, 3 $$,
  $$ select role, from_status, to_status from allowed_transitions order by 1, 2, 3 $$,
  'can_change_klash_status allows exactly the listed transitions');

select * from finish();
rollback;
