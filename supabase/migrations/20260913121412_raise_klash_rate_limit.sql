-- Raises the klash creation rate limit from 10 to 250 per 24h (spec §4,
-- updated in docs/spec.md alongside this migration). The original 10/24h
-- limit blocked repeated manual testing of the creation flow during the
-- step 4 preview review; 250 leaves real abuse still bounded while no
-- longer getting in the way of testing. Comment-creation rate limiting
-- (step 6) is untouched.
create or replace function public.enforce_rate_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  recent_count integer;
begin
  select count(*) into recent_count
    from public.klashes
   where author_id = new.author_id
     and created_at > now() - interval '24 hours';

  if recent_count >= 250 then
    raise exception 'rate limit exceeded: max 250 klashes per 24h';
  end if;

  return new;
end;
$$;
