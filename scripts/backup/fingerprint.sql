-- One line per schema object the app depends on, for the restore check: the
-- same query runs on the source at dump time and on the restored database,
-- and the two outputs must be identical. Definitions are hashed, so any
-- difference in a policy, function, trigger, view or column shows up.
-- Run with `psql -At`; the empty search_path keeps deparsed names qualified.
set search_path = '';

select line from (
  select format('policy %s.%s %s %s', schemaname, tablename, policyname,
                md5(concat_ws('|', permissive, roles::text, cmd, qual, with_check))) as line
  from pg_catalog.pg_policies
  where schemaname in ('public', 'auth', 'storage')

  union all
  select format('trigger %s.%s %s %s', n.nspname, c.relname, t.tgname,
                md5(pg_catalog.pg_get_triggerdef(t.oid)))
  from pg_catalog.pg_trigger t
  join pg_catalog.pg_class c on c.oid = t.tgrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  join pg_catalog.pg_proc p on p.oid = t.tgfoid
  join pg_catalog.pg_namespace pn on pn.oid = p.pronamespace
  -- On auth/storage tables, only our own triggers: the platform's own ones
  -- depend on the Auth/Storage version, which differs between the hosted
  -- project and the local stack the restore check runs on.
  where n.nspname in ('public', 'auth', 'storage') and not t.tgisinternal
    and (n.nspname = 'public' or pn.nspname not in ('auth', 'storage'))

  union all
  select format('function public.%s(%s) %s', p.proname,
                pg_catalog.pg_get_function_identity_arguments(p.oid),
                md5(pg_catalog.pg_get_functiondef(p.oid)))
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind in ('f', 'p')

  union all
  select format('relation public.%s %s rls=%s columns=%s', c.relname, c.relkind,
                c.relrowsecurity,
                md5(coalesce((select string_agg(a.attname || ' ' || pg_catalog.format_type(a.atttypid, a.atttypmod)
                                                || case when a.attnotnull then ' not null' else '' end,
                                                ', ' order by a.attnum)
                              from pg_catalog.pg_attribute a
                              where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped), '')))
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p')

  union all
  select format('view public.%s %s', c.relname, md5(pg_catalog.pg_get_viewdef(c.oid)))
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('v', 'm')

  union all
  select format('type public.%s %s', t.typname,
                coalesce((select string_agg(e.enumlabel, ',' order by e.enumsortorder)
                          from pg_catalog.pg_enum e where e.enumtypid = t.oid), t.typtype::text))
  from pg_catalog.pg_type t
  join pg_catalog.pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public' and t.typtype in ('e', 'd')
) as objects
order by line;
