-- Campaign tracking, part 2: how each account arrived.
--
-- A separate private table, not columns on profiles: profiles is readable by
-- everyone (profiles_select_all), and an account's acquisition channel
-- (e.g. cpam / mail-salaries) must not be. The table has RLS enabled with no
-- policy and no client privilege at all; it is written once by
-- handle_new_user() and only ever read, in aggregate, by SECURITY DEFINER
-- functions reserved to campaign managers. Rows can never be updated.
--
-- The values come from the browser (options.data of signInWithOtp, stored by
-- Supabase in auth.users.raw_user_meta_data) and are therefore untrusted:
-- sanitize_attribution_touch() re-validates every field, and a bad value
-- degrades to "unknown" instead of failing the sign-up.

create table public.profile_attributions (
  profile_id             uuid primary key references public.profiles (id) on delete cascade,
  first_seen_at          timestamptz not null,

  first_source           text not null default 'direct' check (public.is_campaign_token(first_source)),
  first_medium           public.campaign_medium,
  first_campaign         text check (first_campaign is null or public.is_campaign_token(first_campaign)),
  first_content          text check (first_content is null or public.is_campaign_token(first_content)),
  first_referrer_host    text check (char_length(first_referrer_host) <= 253),

  last_source            text not null default 'direct' check (public.is_campaign_token(last_source)),
  last_medium            public.campaign_medium,
  last_campaign          text check (last_campaign is null or public.is_campaign_token(last_campaign)),
  last_content           text check (last_content is null or public.is_campaign_token(last_content)),
  last_referrer_host     text check (char_length(last_referrer_host) <= 253)
);

alter table public.profile_attributions enable row level security;
revoke all on public.profile_attributions from anon, authenticated;

create function public.guard_profile_attributions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'profile attribution is immutable';
end;
$$;

-- Applies to every role, postgres included; deleting a profile still cascades
-- (the trigger is on UPDATE only).
create trigger profile_attributions_immutable
  before update on public.profile_attributions
  for each row execute function public.guard_profile_attributions();

-- ---------- Validation of one client-supplied touch ----------
-- A usable token is a short string following the naming convention; anything
-- else (wrong type, too long, uppercase, accents...) becomes null.
create function public.sanitize_attribution_token(value jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(value) = 'string' and public.is_campaign_token(value #>> '{}')
      then value #>> '{}'
  end;
$$;

create function public.sanitize_attribution_touch(touch jsonb)
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
  medium := case when v_medium in ('social', 'email', 'print', 'press')
                 then v_medium::public.campaign_medium end;
  campaign := public.sanitize_attribution_token(touch -> 'campaign');
  content := public.sanitize_attribution_token(touch -> 'content');
  referrer_host := case when v_host ~ '^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$' then v_host end;
  return next;
end;
$$;

-- ---------- Sign-up: store the attribution ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta  jsonb := new.raw_user_meta_data -> 'attribution';
  v_first record;
  v_last  record;
  v_seen  timestamptz;
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;

  -- Whatever happens below, the sign-up itself must go through.
  begin
    if jsonb_typeof(v_meta) = 'object' then
      select * into v_first from public.sanitize_attribution_touch(v_meta -> 'first_touch');
      select * into v_last from public.sanitize_attribution_touch(v_meta -> 'last_touch');
      -- A missing last touch means the first one is also the latest.
      if v_last.source is null and v_last.referrer_host is null then
        v_last := v_first;
      end if;

      begin
        v_seen := (v_meta ->> 'first_seen_at')::timestamptz;
      exception when others then
        v_seen := null;
      end;
      v_seen := least(greatest(coalesce(v_seen, now()), now() - interval '2 years'), now());
    end if;

    insert into public.profile_attributions (
      profile_id, first_seen_at,
      first_source, first_medium, first_campaign, first_content, first_referrer_host,
      last_source, last_medium, last_campaign, last_content, last_referrer_host
    ) values (
      new.id, coalesce(v_seen, now()),
      coalesce(v_first.source, case when v_first.referrer_host is not null then 'referral' end, 'direct'),
      v_first.medium, v_first.campaign, v_first.content, v_first.referrer_host,
      coalesce(v_last.source, case when v_last.referrer_host is not null then 'referral' end, 'direct'),
      v_last.medium, v_last.campaign, v_last.content, v_last.referrer_host
    ) on conflict (profile_id) do nothing;
  exception when others then
    insert into public.profile_attributions (profile_id, first_seen_at)
    values (new.id, now())
    on conflict (profile_id) do nothing;
  end;

  return new;
end;
$$;

-- ---------- Existing accounts ----------
insert into public.profile_attributions (profile_id, first_seen_at)
select p.id, p.created_at
from public.profiles p
where p.id <> '00000000-0000-4000-8000-000000000001'
on conflict (profile_id) do nothing;
