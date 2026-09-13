-- Step 5 (photos): the last behaviour-gating trigger deferred by the initial
-- migration, plus the Storage side of photos, which the initial migration
-- could not create — no table for it exists in `public`.

-- ---------- Trigger: limit photos per klash (spec §4: max 3) ----------
create or replace function public.enforce_photo_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  photo_count integer;
begin
  select count(*) into photo_count
    from public.klash_photos
   where klash_id = new.klash_id;

  if photo_count >= 3 then
    raise exception 'photo limit exceeded: max 3 photos per klash';
  end if;

  return new;
end;
$$;

create trigger klash_photos_enforce_photo_limit
  before insert on public.klash_photos
  for each row execute function public.enforce_photo_limit();

-- ---------- Storage bucket: klash-photos (spec §5) ----------
-- Public read, authenticated upload, image/jpeg|png|webp only, 2 MB cap.
-- Declared here (not in supabase/config.toml's commented [storage.buckets.*]
-- template) because config.toml only seeds the local stack — production
-- reads none of it, so the bucket must exist as a migration to reach both.
-- `on conflict` makes this re-runnable and the place to adjust limits later.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'klash-photos',
  'klash-photos',
  true,
  2097152, -- 2 MiB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------- Storage policies: storage.objects (spec §5) ----------
-- Objects are stored as '{klash_id}/{uuid}.jpg' (storage_path in
-- klash_photos holds this same bucket-relative path, not a
-- 'klash-photos/...'-prefixed one, so it can be passed straight to the
-- Storage client's upload()/getPublicUrl() with no string surgery).
--
-- The upload/delete policies must check that the klash_id folder segment
-- belongs to a klash the caller authors. That segment is untrusted text, and
-- casting an arbitrary string to uuid raises an error rather than failing
-- the comparison (verified locally: `select 'not-a-uuid'::uuid` throws) —
-- casting inside the policy would turn a merely-malformed upload attempt
-- into a hard error instead of a clean RLS rejection. The regex guard below
-- short-circuits before the cast ever runs.
create policy klash_photos_objects_select_all on storage.objects
  for select
  using (bucket_id = 'klash-photos');

create policy klash_photos_objects_insert_klash_author on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'klash-photos'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and exists (
      select 1 from public.klashes k
       where k.id = ((storage.foldername(name))[1])::uuid
         and k.author_id = auth.uid()
    )
  );

create policy klash_photos_objects_delete_author_or_staff on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'klash-photos'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (
      public.current_user_role() in ('moderator', 'admin')
      or exists (
        select 1 from public.klashes k
         where k.id = ((storage.foldername(name))[1])::uuid
           and k.author_id = auth.uid()
      )
    )
  );

-- Known gap, out of scope for this step: deleting a klash cascades its
-- klash_photos rows (on delete cascade) but does not remove the underlying
-- Storage objects, which become orphaned. Cleaning those up belongs with the
-- deletion/moderation work in step 7.
