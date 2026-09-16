-- Raises the per-klash photo limit from 3 to 12 (spec §4), at the
-- association's request. The trigger itself doesn't need recreating
-- (create or replace function is enough), only its body.
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

  if photo_count >= 12 then
    raise exception 'photo limit exceeded: max 12 photos per klash';
  end if;

  return new;
end;
$$;
