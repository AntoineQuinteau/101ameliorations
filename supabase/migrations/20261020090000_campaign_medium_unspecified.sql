-- Campaign links: a medium can be left unspecified.
-- A link always carries a medium (utm_medium is what makes an arrival a
-- campaign touch), so "not specified" is an explicit value of the closed list
-- rather than a null. It sorts first: it is the form's default.

alter type public.campaign_medium add value if not exists 'unspecified' before 'social';

-- Accept the new value when storing a touch at sign-up and install.
create or replace function public.sanitize_attribution_touch(touch jsonb)
returns table (
  source        text,
  medium        public.campaign_medium,
  campaign      text,
  content       text,
  referrer_host text
)
language plpgsql
immutable
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
  medium := case when v_medium in ('unspecified', 'social', 'email', 'print', 'press')
                 then v_medium::public.campaign_medium end;
  campaign := public.sanitize_attribution_token(touch -> 'campaign');
  content := public.sanitize_attribution_token(touch -> 'content');
  referrer_host := case when v_host ~ '^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$' then v_host end;
  return next;
end;
$$;
