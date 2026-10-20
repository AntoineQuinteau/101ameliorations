-- The campaign medium list lives in one place: the public.campaign_medium enum.
-- sanitize_attribution_touch() used to repeat it as a literal `in (...)` list,
-- which had to be edited by hand with every `alter type ... add value`. It now
-- reads the enum itself, so a new value is accepted as soon as it is added.
--
-- The function becomes `stable` instead of `immutable`: enum_range() is stable
-- (its result changes when a value is added), and an immutable function that
-- calls a stable one misleads the planner. Its callers (handle_new_user and
-- record_install) are volatile plpgsql functions and use no index or
-- constraint depending on it, so nothing else changes.

create or replace function public.sanitize_attribution_touch(touch jsonb)
returns table (
  source        text,
  medium        public.campaign_medium,
  campaign      text,
  content       text,
  referrer_host text
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_medium text;
  v_host   text;
begin
  if jsonb_typeof(touch) is distinct from 'object' then
    return;
  end if;

  v_medium := case when jsonb_typeof(touch -> 'medium') = 'string' then touch ->> 'medium' end;
  v_host := case when jsonb_typeof(touch -> 'referrer_host') = 'string'
                 then lower(touch ->> 'referrer_host') end;

  source := public.sanitize_attribution_token(touch -> 'source');
  medium := case when v_medium = any (pg_catalog.enum_range(null::public.campaign_medium)::text[])
                 then v_medium::public.campaign_medium end;
  campaign := public.sanitize_attribution_token(touch -> 'campaign');
  content := public.sanitize_attribution_token(touch -> 'content');
  referrer_host := case when v_host ~ '^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$' then v_host end;
  return next;
end;
$$;
