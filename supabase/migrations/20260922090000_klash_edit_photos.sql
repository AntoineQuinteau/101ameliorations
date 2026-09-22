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
--      storage.objects DELETE policy already allows "klash author or
--      staff"; this brings the table policy in line, so the two sides of
--      one delete can no longer disagree. Deliberately NOT gated on
--      status = 'new': removing a photo of oneself is not a content edit,
--      and the storage side has never been gated either — a status gate
--      here would strand objects whose row can no longer be deleted.
--
-- storage.objects DELETE needs no change: klash_photos_objects_delete_
-- author_or_staff already covers staff and the klash's author, which is
-- exactly (c) on the storage side.

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

alter policy klash_photos_objects_insert_klash_author on storage.objects
  rename to klash_photos_objects_insert_klash_author_or_staff;

-- ---------- (c) klash_photos DELETE ----------
alter policy klash_photos_delete_author_or_staff on public.klash_photos
  using (
    author_id = auth.uid()
    or public.current_user_role() in ('moderator', 'admin')
    or exists (
      select 1 from public.klashes k
       where k.id = klash_id and k.author_id = auth.uid()
    )
  );
