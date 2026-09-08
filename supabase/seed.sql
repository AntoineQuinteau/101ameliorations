-- Seed data for step 2 (map + read): ~630 test klashs spread over the
-- service area, so the map has ~500 visible after the default map filters
-- (klashes_in_bbox excludes rejected/duplicate and resolved older than 90
-- days — spec §6.1, §11.4).
--
-- Reproducible (setseed) and idempotent: safe to re-run against an existing
-- database (used to refresh this data on the production project so preview
-- deployments have something to show). Everything this script creates is
-- keyed off a fixed set of seed-user ids, so re-running it first removes
-- exactly what a previous run inserted, then recreates it.
--
-- Row content (titles, descriptions, place names) is in French: it is
-- user-generated test *data*, not UI text, so it does not belong in
-- src/i18n/fr.ts (see CLAUDE.md).

begin;

select setseed(0.4242);

-- ---------- Reference data for this script only ----------
drop table if exists seed_users;
create temporary table seed_users (
  id           uuid primary key,
  email        text not null,
  display_name text
);

insert into seed_users (id, email, display_name) values
  ('10000000-0000-4000-8000-000000000001', 'seed-01@101ameliorations.test', 'Camille B.'),
  ('10000000-0000-4000-8000-000000000002', 'seed-02@101ameliorations.test', 'Julien P.'),
  ('10000000-0000-4000-8000-000000000003', 'seed-03@101ameliorations.test', 'Sophie'),
  ('10000000-0000-4000-8000-000000000004', 'seed-04@101ameliorations.test', 'Manex'),
  ('10000000-0000-4000-8000-000000000005', 'seed-05@101ameliorations.test', 'Lucie D.'),
  ('10000000-0000-4000-8000-000000000006', 'seed-06@101ameliorations.test', 'Thomas'),
  ('10000000-0000-4000-8000-000000000007', 'seed-07@101ameliorations.test', 'Ana'),
  ('10000000-0000-4000-8000-000000000008', 'seed-08@101ameliorations.test', 'Peio'),
  ('10000000-0000-4000-8000-000000000009', 'seed-09@101ameliorations.test', 'Claire M.'),
  ('10000000-0000-4000-8000-000000000010', 'seed-10@101ameliorations.test', 'Mikel'),
  ('10000000-0000-4000-8000-000000000011', 'seed-11@101ameliorations.test', null),
  ('10000000-0000-4000-8000-000000000012', 'seed-12@101ameliorations.test', null);

drop table if exists seed_hubs;
create temporary table seed_hubs (
  id     serial primary key,
  name   text not null,
  lat    double precision not null,
  lng    double precision not null,
  weight int not null
);

-- Population centres across the service area, weighted roughly by size, so
-- klashs cluster the way real reports would (and clustering/bbox loading
-- are actually exercised) instead of scattering uniformly.
insert into seed_hubs (name, lat, lng, weight) values
  ('Bayonne',                  43.4933, -1.4746, 18),
  ('Anglet',                   43.4830, -1.5228, 12),
  ('Biarritz',                 43.4832, -1.5586, 12),
  ('Saint-Jean-de-Luz',        43.3891, -1.6636,  8),
  ('Hendaye',                  43.3624, -1.7736,  6),
  ('Cambo-les-Bains',          43.3592, -1.4064,  7),
  ('Espelette',                43.3572, -1.4467,  3),
  ('Capbreton',                43.6595, -1.4256,  8),
  ('Saint-Vincent-de-Tyrosse', 43.6564, -1.3005,  5),
  ('Dax',                      43.7102, -1.0514, 10),
  ('Peyrehorade',              43.5423, -1.1266,  4),
  ('Saint-Palais',             43.3395, -1.0034,  3);

-- ---------- Cleanup (no-op on a fresh database) ----------
update public.klashes set duplicate_of = null
 where author_id in (select id from seed_users);
delete from public.confirmations
 where user_id in (select id from seed_users)
    or klash_id in (select id from public.klashes where author_id in (select id from seed_users));
delete from public.klashes where author_id in (select id from seed_users);
delete from auth.users where id in (select id from seed_users); -- cascades profiles

-- ---------- Seed auth users + profiles ----------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  is_sso_user, is_anonymous, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000', su.id, 'authenticated', 'authenticated',
  su.email, crypt('seed-not-a-real-password', gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  false, false, now(), now(),
  '', '', '', ''
from seed_users su;

-- handle_new_user() created the profile rows; fill in display names (role
-- stays the default 'user' — profiles_guard_role blocks changing it here).
update public.profiles p
set display_name = su.display_name
from seed_users su
where p.id = su.id and su.display_name is not null;

-- ---------- Klashs ----------
-- Word bank used to compose plausible French titles/descriptions.
drop table if exists seed_phrases;
create temporary table seed_phrases (id serial primary key, phrase text not null);
insert into seed_phrases (phrase) values
  ('Nid-de-poule dangereux'),
  ('Piste cyclable bloquée par des véhicules garés'),
  ('Marquage au sol effacé'),
  ('Bordure de trottoir trop haute'),
  ('Trou important sur la chaussée'),
  ('Éclairage public défaillant'),
  ('Végétation envahissante sur la piste'),
  ('Revêtement fissuré et glissant'),
  ('Absence de piste cyclable sur un tronçon dangereux'),
  ('Feu tricolore mal réglé pour les vélos'),
  ('Stationnement gênant sur la piste cyclable'),
  ('Signalisation manquante'),
  ('Piste cyclable interrompue brutalement'),
  ('Traversée dangereuse pour les cyclistes'),
  ('Gravillons non nettoyés après travaux');

drop table if exists seed_streets;
create temporary table seed_streets (id serial primary key, street text not null);
insert into seed_streets (street) values
  ('avenue du Maréchal Foch'), ('rue Thiers'), ('boulevard du BAB'),
  ('avenue de Bayonne'), ('chemin de Mousserolles'), ('rue Gambetta'),
  ('avenue de la Milady'), ('route de Cambo'), ('quai Amiral Dubourdieu'),
  ('avenue de l''Adour'), ('rue Victor Hugo'), ('avenue de la Plage'),
  ('chemin des Vignes'), ('rue du Port'), ('avenue de la Gare'),
  ('route départementale 810'), ('allée des Platanes'), ('rue du Pont'),
  ('avenue des Pyrénées'), ('chemin de la Barre');

drop table if exists seed_fillers;
create temporary table seed_fillers (id serial primary key, filler text not null);
insert into seed_fillers (filler) values
  ('Gêne réelle pour les cyclistes, en particulier aux heures de pointe.'),
  ('Situation signalée à plusieurs reprises par les usagers.'),
  ('Risque de chute élevé, notamment par temps de pluie.'),
  ('Détour obligatoire par la chaussée principale, dangereux avec la circulation.'),
  ('Problème présent depuis plusieurs semaines.'),
  ('Intervention souhaitée avant la prochaine saison touristique.');

-- One row per generated klash. Point jitter around each hub uses a
-- Box-Muller transform for a roughly gaussian spread (sigma ~= 1.3 km)
-- instead of a uniform square, then clamps to the service area bbox
-- (spec §4: lat 43.25-43.80, lng -1.80 to -0.90).
insert into public.klashes (
  author_id, location, category, urgency, status,
  title, description, created_at, updated_at, resolved_at
)
select
  base.author_id,
  (extensions.st_setsrid(
     extensions.st_makepoint(derived.final_lng, derived.final_lat), 4326
   ))::extensions.geography,
  derived.category,
  derived.urgency,
  derived.status,
  content.title,
  content.description,
  base.created_at,
  coalesce(dates.resolved_at, base.created_at),
  dates.resolved_at
from generate_series(1, 630) as s(n)
cross join lateral (
  select
    (select id from seed_users where s.n > 0 order by random() limit 1) as author_id,
    (select id from seed_hubs where s.n > 0 order by power(random(), 1.0 / weight) desc limit 1) as hub_id,
    random() as u1,
    random() as u2,
    random() as status_r,
    random() as category_r,
    random() as urgency_r,
    -- 548 days (~18 months) back, squared to bias toward recent reports.
    now() - (548 * power(random(), 2)) * interval '1 day' as created_at
  -- `where s.n > 0` is not a filter: it correlates this subquery to the
  -- outer generate_series row, which is what makes Postgres re-run the
  -- random() calls above once per row instead of once for the whole query.
  where s.n > 0
) as base
cross join lateral (
  select lat as hub_lat, lng as hub_lng, name as hub_name
  from seed_hubs where id = base.hub_id
) as hub
cross join lateral (
  select
    least(43.80, greatest(43.25, hub.hub_lat
      + sqrt(-2 * ln(base.u1)) * cos(2 * pi() * base.u2) * 1.3 / 111.0)) as final_lat,
    least(-0.90, greatest(-1.80, hub.hub_lng
      + sqrt(-2 * ln(base.u1)) * sin(2 * pi() * base.u2) * 1.3
        / (111.0 * cos(radians(hub.hub_lat))))) as final_lng,
    (case
      when base.status_r < 0.45 then 'new'
      when base.status_r < 0.57 then 'acknowledged'
      when base.status_r < 0.67 then 'in_progress'
      when base.status_r < 0.92 then 'resolved'
      when base.status_r < 0.97 then 'rejected'
      else 'duplicate'
    end)::public.klash_status as status,
    (case
      when base.category_r < 0.30 then 'category_1'
      when base.category_r < 0.55 then 'category_2'
      when base.category_r < 0.75 then 'category_3'
      when base.category_r < 0.90 then 'category_4'
      else 'category_5'
    end)::public.klash_category as category,
    (case
      when base.urgency_r < 0.25 then 'low'
      when base.urgency_r < 0.75 then 'medium'
      else 'high'
    end)::public.klash_urgency as urgency
) as derived
cross join lateral (
  select case when derived.status = 'resolved'
              then least(now(), base.created_at
                     + (5 + floor(random() * 116)) * interval '1 day')
              else null end as resolved_at
) as dates
cross join lateral (
  select
    (select phrase from seed_phrases where s.n > 0 order by random() limit 1) as phrase,
    (select street from seed_streets where s.n > 0 order by random() limit 1) as street,
    (select filler from seed_fillers where s.n > 0 order by random() limit 1) as filler
  where s.n > 0 -- see note on `base`: forces per-row re-evaluation
) as words
cross join lateral (
  select
    words.phrase || ' – ' || words.street || ', ' || hub.hub_name as title,
    words.phrase || ' signalé ' || words.street || ' (' || hub.hub_name || '). '
      || words.filler as description
) as content;

-- Point some of the 'duplicate' klashs at an earlier klash (same category
-- when possible), leaving the rest without a target as real data would.
update public.klashes k
set duplicate_of = (
  select k2.id
  from public.klashes k2
  where k2.author_id in (select id from seed_users)
    and k2.id <> k.id
    and k2.created_at < k.created_at
  order by (k2.category = k.category) desc, random()
  limit 1
)
where k.status = 'duplicate'
  and k.author_id in (select id from seed_users);

-- ---------- Confirmations ----------
-- ~13% of (klash, non-author seed user) pairs, which lands around 900 rows
-- given ~630 klashs x 11 eligible confirmers each.
insert into public.confirmations (klash_id, user_id)
select k.id, su.id
from public.klashes k
cross join seed_users su
where k.author_id in (select id from seed_users)
  and su.id <> k.author_id
  and random() < 0.132
on conflict (klash_id, user_id) do nothing;

drop table seed_users;
drop table seed_hubs;
drop table seed_phrases;
drop table seed_streets;
drop table seed_fillers;

commit;
