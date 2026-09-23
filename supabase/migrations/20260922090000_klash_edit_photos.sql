-- Editing a klash from its detail page (spec §6.3: "Actions contextuelles
-- selon rôle : Modifier ... (auteur si `new`, moderator, admin)"). The
-- klashes table already grants exactly that scope
-- (klashes_update_author_new + klashes_update_staff, see
-- 20260907225955_initial_schema.sql and 20260915075244_klash_lifecycle.sql)
-- — nothing here touches it. What the edit form adds is photo *management*
-- from the detail page, and that is where the policies are wrong today:
--
--  (a) A moderator/admin can edit anyone's klash but cannot add a photo to
--      it: klash_photos_insert_klash_author (table) and
--      klash_photos_objects_insert_klash_author (storage) both require the
--      caller to be the *klash's* author. Spec §2, row "Modifier /
--      supprimer / masquer n'importe quel klash, photo, commentaire": ✓ for
--      moderator and admin. The staff member becomes the photo's author
--      (author_id = auth.uid()), so the `author_id = auth.uid()` half of
--      the check is kept for every role — nobody may attribute a photo to
--      someone else.
--
--  (b) The klash author's own insert now additionally requires the klash to
--      still be `status = 'new'`. THIS TIGHTENS CURRENT BEHAVIOUR: today an
--      author can add a photo to their klash at any status. It aligns the
--      database with spec §2's rule ("Un `user` ne peut plus modifier
--      catégorie/position/description de son klash une fois qu'il n'est
--      plus en statut `new`") and with the UI gate the edit form applies.
--      Verified safe against every existing write path: the only one is
--      NewKlashPage's upload immediately after create_klash(), where the
--      klash is always 'new'.
--
--  (c) DELETE on klash_photos was keyed on klash_photos.author_id only, so
--      once (a) lets a moderator upload onto someone's klash, the klash's
--      own author could not remove that photo from their own report. The
--      storage.objects DELETE policy already allowed "klash author or
--      staff" for this case, so both sides need the same new branch, kept
--      symmetric with each other.
--
--      That new branch — the klash's own author removing a photo they did
--      not upload themselves — is gated on status = 'new', matching (b):
--      a `user` should not be able to remove evidence staff attached
--      (e.g. a completion photo) once the klash has moved past `new`. The
--      other two branches on each policy stay ungated: staff must be able
--      to remove a photo at any status, and a photo's own author removing
--      their own upload isn't the case this gate is about.
--
--      klash_photos_objects_delete_author_or_staff (storage.objects, from
--      20260913140000_klash_photos_storage.sql) needs the same new
--      branch too, or an author blocked from deleting the klash_photos row
--      past `new` could still delete the underlying Storage object
--      directly, leaving a row that survives pointing at nothing. It
--      ALSO needs a branch it never had: a photo's own uploader removing
--      their own upload, ungated, the way public.klash_photos always has
--      via author_id = auth.uid(). That branch was never missed before
--      (a): only the klash's own author could ever upload a photo, so
--      klash_photos.author_id and the klash's author were always the same
--      person, and the "klash author" branch alone covered both cases.
--      (a) breaks that invariant — a moderator can now be a photo's
--      uploader on someone else's klash — so without this branch, a plain
--      user's own upload on their own klash becomes un-deletable from
--      Storage (though its klash_photos row still is, via the ungated
--      table-side author_id branch) the moment status leaves `new`,
--      orphaning the object. storage.objects has no author_id column of
--      its own; the branch below joins through klash_photos by
--      storage_path instead, which klashPhotoPublicUrl's docblock already
--      establishes is the same bucket-relative path as storage.objects.name.
--
-- Note on naming: klash_photos_insert_klash_author (below) is renamed to
-- reflect that it now also admits staff, but its storage.objects
-- counterpart keeps its original name — storage.objects is owned by
-- Supabase's supabase_storage_admin role, not by whatever role runs this
-- migration, and `alter policy ... rename to ...` is a strict ownership
-- check with no grantable workaround (unlike `alter policy ... with
-- check`, which only edits the policy's expression and does not require
-- ownership the same way). Verified against a CI run: renaming
-- klash_photos_insert_klash_author on public.klash_photos succeeded;
-- renaming the storage.objects policy failed with "must be owner of table
-- objects". The asymmetric name is intentional — do not "fix" it with
-- another rename attempt.

-- ---------- (a) + (b) klash_photos INSERT ----------
alter policy klash_photos_insert_klash_author on public.klash_photos
  with check (
    author_id = auth.uid()
    and (
      public.current_user_role() in ('moderator', 'admin')
      or exists (
        select 1 from public.klashes k
         where k.id = klash_id
           and k.author_id = auth.uid()
           and k.status = 'new'
      )
    )
  );

alter policy klash_photos_insert_klash_author on public.klash_photos
  rename to klash_photos_insert_klash_author_or_staff;

-- ---------- (a) + (b) storage.objects INSERT, mirrored ----------
-- Same regex-then-cast idiom as the original policy, and for the same
-- reason: casting an arbitrary folder segment straight to uuid raises
-- instead of failing the comparison, so the regex must short-circuit.
alter policy klash_photos_objects_insert_klash_author on storage.objects
  with check (
    bucket_id = 'klash-photos'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (
      public.current_user_role() in ('moderator', 'admin')
      or exists (
        select 1 from public.klashes k
         where k.id = ((storage.foldername(name))[1])::uuid
           and k.author_id = auth.uid()
           and k.status = 'new'
      )
    )
  );

-- ---------- (c) klash_photos DELETE ----------
alter policy klash_photos_delete_author_or_staff on public.klash_photos
  using (
    author_id = auth.uid()
    or public.current_user_role() in ('moderator', 'admin')
    or exists (
      select 1 from public.klashes k
       where k.id = klash_id and k.author_id = auth.uid() and k.status = 'new'
    )
  );

-- ---------- (c) storage.objects DELETE, mirrored ----------
alter policy klash_photos_objects_delete_author_or_staff on storage.objects
  using (
    bucket_id = 'klash-photos'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (
      public.current_user_role() in ('moderator', 'admin')
      or exists (
        select 1 from public.klash_photos p
         where p.storage_path = name and p.author_id = auth.uid()
      )
      or exists (
        select 1 from public.klashes k
         where k.id = ((storage.foldername(name))[1])::uuid
           and k.author_id = auth.uid()
           and k.status = 'new'
      )
    )
  );
