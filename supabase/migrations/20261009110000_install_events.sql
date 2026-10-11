-- Campaign tracking, part 3: PWA installations.
--
-- One row per install, with the attribution the installing browser held at
-- that moment (the stored first/last touch) and the platform. Deliberately no
-- account id, device id, IP or user agent: an install is a counter attributed
-- to a channel, nothing more. Written only through record_install(), which
-- re-validates what the client sends with the same sanitizer as sign-ups;
-- never readable by clients (aggregates only, for campaign managers).

create table public.install_events (
  id              bigint generated always as identity primary key,
  installed_at    timestamptz not null default now(),
  platform        text not null check (platform in ('android', 'ios', 'desktop', 'other')),

  first_source    text not null default 'direct' check (public.is_campaign_token(first_source)),
  first_medium    public.campaign_medium,
  first_campaign  text check (first_campaign is null or public.is_campaign_token(first_campaign)),
  first_content   text check (first_content is null or public.is_campaign_token(first_content)),

  last_source     text not null default 'direct' check (public.is_campaign_token(last_source)),
  last_medium     public.campaign_medium,
  last_campaign   text check (last_campaign is null or public.is_campaign_token(last_campaign)),
  last_content    text check (last_content is null or public.is_campaign_token(last_content))
);
create index install_events_installed_at_idx on public.install_events (installed_at);

alter table public.install_events enable row level security;
revoke all on public.install_events from anon, authenticated;

create function public.record_install(
  p_platform text,
  p_first_touch jsonb default null,
  p_last_touch jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_first record;
  v_last  record;
begin
  select * into v_first from public.sanitize_attribution_touch(p_first_touch);
  select * into v_last from public.sanitize_attribution_touch(p_last_touch);
  if v_last.source is null and v_last.referrer_host is null then
    v_last := v_first;
  end if;

  insert into public.install_events (
    platform,
    first_source, first_medium, first_campaign, first_content,
    last_source, last_medium, last_campaign, last_content
  ) values (
    case when p_platform in ('android', 'ios', 'desktop') then p_platform else 'other' end,
    coalesce(v_first.source, case when v_first.referrer_host is not null then 'referral' end, 'direct'),
    v_first.medium, v_first.campaign, v_first.content,
    coalesce(v_last.source, case when v_last.referrer_host is not null then 'referral' end, 'direct'),
    v_last.medium, v_last.campaign, v_last.content
  );
end;
$$;

grant execute on function public.record_install(text, jsonb, jsonb) to anon, authenticated;
