-- Emits, as SQL, the objects this project attaches to tables in the
-- platform-managed `auth` and `storage` schemas: RLS policies (e.g. the
-- klash-photos policies on storage.objects) and triggers calling our own
-- functions (e.g. on_auth_user_created on auth.users).
--
-- `supabase db dump` skips those schemas entirely, so without this file a
-- restored project would silently lose them. Run with `psql -At`; the empty
-- search_path makes pg_get_expr / pg_get_triggerdef schema-qualify every name.
set search_path = '';

select format(
  'create policy %I on %I.%I as %s for %s to %s%s%s;',
  policyname,
  schemaname,
  tablename,
  permissive,
  cmd,
  (select string_agg(case when r = 'public' then 'public' else quote_ident(r) end, ', ')
     from unnest(roles) as r),
  case when qual is not null then format(' using (%s)', qual) else '' end,
  case when with_check is not null then format(' with check (%s)', with_check) else '' end
)
from pg_catalog.pg_policies
where schemaname in ('auth', 'storage')
order by schemaname, tablename, policyname;

select pg_catalog.pg_get_triggerdef(t.oid) || ';'
from pg_catalog.pg_trigger t
join pg_catalog.pg_class c on c.oid = t.tgrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
join pg_catalog.pg_proc p on p.oid = t.tgfoid
join pg_catalog.pg_namespace pn on pn.oid = p.pronamespace
where n.nspname in ('auth', 'storage')
  and not t.tgisinternal
  and pn.nspname not in ('auth', 'storage')
order by n.nspname, c.relname, t.tgname;
