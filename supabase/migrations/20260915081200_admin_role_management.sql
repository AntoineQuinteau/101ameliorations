-- Step 7: /admin role management (spec §6.6, admin only). The client can
-- already read and write profiles.role/organization directly for any row
-- (profiles_update_admin already grants an admin an unrestricted UPDATE, and
-- profiles_select_all is public) — no new RPC needed for that part. What's
-- missing is finding *which* profile to update: an admin only has the
-- target's email, and auth.users isn't reachable from the client (no RLS
-- exists on Supabase's own auth schema, so PostgREST doesn't expose it) and
-- has no public.profiles counterpart holding email. This RPC is that lookup.
--
-- SECURITY DEFINER to read auth.users; scoped to admin only, and returns
-- only what's needed to act on the account (id, display_name, role,
-- organization) — never the email back out beyond confirming a match, so
-- this doesn't become a general email-existence oracle for anyone who
-- reaches admin status.
create function public.find_profile_by_email(email text)
returns table (
  id           uuid,
  display_name text,
  role         public.user_role,
  organization text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(public.current_user_role(), 'user') <> 'admin' then
    raise exception 'only an admin can search for a profile by email';
  end if;

  return query
    select p.id, p.display_name, p.role, p.organization
    from public.profiles p
    join auth.users u on u.id = p.id
    where u.email = find_profile_by_email.email;
end;
$$;

revoke execute on function public.find_profile_by_email(text) from public, anon;
grant execute on function public.find_profile_by_email(text) to authenticated;
