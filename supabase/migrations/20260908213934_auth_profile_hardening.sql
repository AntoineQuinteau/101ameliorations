-- Step 3 (auth): hardening around the first user-facing writes to `profiles`,
-- plus the index the "my klashes" page needs.

-- ---------- Index: klashes by author ----------
-- /me filters on author_id and sorts by created_at desc; nothing covered that
-- path before (the existing indexes are on location, created_at and status).
create index klashes_author_id_idx on public.klashes (author_id, created_at desc);

-- ---------- Guard: `organization` is admin-only, like `role` ----------
-- `profiles_update_own` lets a user update their own row, and
-- `klashes_public.author_organization` is publicly readable next to every klash
-- they post. Without this guard any user could set organization = 'CAPB' and
-- impersonate the authority. Spec §6.6: organization is filled in by an admin.
create or replace function public.guard_profiles_role()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role
     and coalesce(public.current_user_role(), 'user') <> 'admin' then
    raise exception 'only an admin can change a profile role';
  end if;

  if new.organization is distinct from old.organization
     and coalesce(public.current_user_role(), 'user') <> 'admin' then
    raise exception 'only an admin can change a profile organization';
  end if;

  return new;
end;
$$;

-- The `profiles_guard_role` trigger already points at this function, so it
-- picks up the new check without being recreated.

-- ---------- pgTAP: database tests (supabase/tests, run by `supabase test db`) ----------
create extension if not exists pgtap with schema extensions;
