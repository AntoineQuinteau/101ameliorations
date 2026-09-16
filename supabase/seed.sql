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
  ('10000000-0000-4000-8000-000000000012', 'seed-12@101ameliorations.test', null),
  -- Step 7: one staff account per non-'user' role, so /admin and the
  -- role-gated actions on /k/:id have someone to log in as locally.
  ('10000000-0000-4000-8000-000000000013', 'seed-moderator@101ameliorations.test', 'Association (modération)'),
  ('10000000-0000-4000-8000-000000000014', 'seed-authority@101ameliorations.test', 'CAPB'),
  ('10000000-0000-4000-8000-000000000015', 'seed-admin@101ameliorations.test', 'Admin');

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
-- Comments authored by a seed user are covered by the klashes cascade below
-- only when they're on a seed klash. Every klash here is seed-authored today,
-- but this delete is kept independent so a seed user's comment on a
-- non-seed klash (not possible yet, but not guaranteed to stay that way)
-- doesn't survive a re-run.
delete from public.comments where author_id in (select id from seed_users);
-- status_changes rows are written by the staff seed accounts (moderator/
-- authority/admin) on klashs authored by other seed accounts, so this
-- delete is independent of the klashes cascade below for the same reason as
-- the comments delete above: a staff seed user's history entry survives
-- only as long as this explicit delete removes it.
delete from public.status_changes where changed_by in (select id from seed_users);
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

-- Step 7: promote the three staff seed accounts. profiles_guard_role reads
-- current_user_role(), i.e. auth.uid() from the JWT claim, not the Postgres
-- session role, so `set local role postgres` alone does not bypass it —
-- disabling the trigger for these statements is the same pattern used by
-- every pgTAP fixture in supabase/tests/ (e.g. comments_rls_test.sql).
alter table public.profiles disable trigger profiles_guard_role;
update public.profiles set role = 'moderator'
 where id = '10000000-0000-4000-8000-000000000013';
update public.profiles set role = 'authority', organization = 'CAPB'
 where id = '10000000-0000-4000-8000-000000000014';
update public.profiles set role = 'admin'
 where id = '10000000-0000-4000-8000-000000000015';
alter table public.profiles enable trigger profiles_guard_role;

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

-- Precisions for the 'category_7' ("Autre (préciser)") branch below —
-- category_other is required whenever that category is picked (see the
-- klashes_category_other_required_check constraint).
drop table if exists seed_other_precisions;
create temporary table seed_other_precisions (id serial primary key, precision_text text not null);
insert into seed_other_precisions (precision_text) values
  ('Éclairage défectueux le soir'),
  ('Stationnement gênant récurrent'),
  ('Odeur/dépôt sauvage sur la piste'),
  ('Bruit de circulation gênant à cet endroit'),
  ('Accès non praticable en fauteuil ou poussette');

-- One row per generated klash. Point jitter around each hub uses a
-- Box-Muller transform for a roughly gaussian spread (sigma ~= 1.3 km)
-- instead of a uniform square. No clamp to the service area bbox: the hubs
-- (seed_hubs) sit well inside it, and sigma ~= 1.3 km is far too small for
-- the jitter alone to ever cross it.
insert into public.klashes (
  author_id, location, category, category_other, urgency, status,
  title, description, created_at, updated_at, resolved_at
)
select
  base.author_id,
  (extensions.st_setsrid(
     extensions.st_makepoint(derived.final_lng, derived.final_lat), 4326
   ))::extensions.geography,
  derived.category,
  derived.category_other,
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
    hub.hub_lat
      + sqrt(-2 * ln(base.u1)) * cos(2 * pi() * base.u2) * 1.3 / 111.0 as final_lat,
    hub.hub_lng
      + sqrt(-2 * ln(base.u1)) * sin(2 * pi() * base.u2) * 1.3
        / (111.0 * cos(radians(hub.hub_lat))) as final_lng,
    (case
      when base.status_r < 0.45 then 'new'
      when base.status_r < 0.57 then 'acknowledged'
      when base.status_r < 0.67 then 'in_progress'
      when base.status_r < 0.92 then 'resolved'
      when base.status_r < 0.97 then 'rejected'
      else 'duplicate'
    end)::public.klash_status as status,
    -- 22/20/16/14/12/10/6%, the last slice ('category_7', "Autre") pairs
    -- with a category_other value below via the same category_r draw.
    (case
      when base.category_r < 0.22 then 'category_1'
      when base.category_r < 0.42 then 'category_2'
      when base.category_r < 0.58 then 'category_3'
      when base.category_r < 0.72 then 'category_4'
      when base.category_r < 0.84 then 'category_5'
      when base.category_r < 0.94 then 'category_6'
      else 'category_7'
    end)::public.klash_category as category,
    (case
      when base.category_r >= 0.94
        then (select precision_text from seed_other_precisions
              where s.n > 0 order by random() limit 1)
      else null
    end) as category_other,
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

-- ---------- Status history (step 7) ----------
-- Klashs above are inserted with an explicit status (an INSERT, so
-- klashes_enforce_status_transition never fires) rather than reaching it
-- through change_klash_status(), so they would otherwise carry no
-- status_changes rows — leaving the "Historique des statuts" section on
-- /k/:id empty for every seeded klash. This synthesises one plausible
-- change_by/note per non-'new' klash, direct-inserted as postgres (bypasses
-- RLS; status_changes has no INSERT policy for anyone else).
--
-- Only the single most recent transition into the seeded status is
-- reconstructed (not the full path through intermediate statuses) — enough
-- to exercise the UI, not a full lifecycle replay.
drop table if exists seed_staff_notes;
create temporary table seed_staff_notes (
  status  public.klash_status primary key,
  actor   uuid not null,
  note    text
);
insert into seed_staff_notes (status, actor, note) values
  ('acknowledged', '10000000-0000-4000-8000-000000000014', 'Pris en compte, transmis aux services techniques.'),
  ('in_progress',  '10000000-0000-4000-8000-000000000014', 'Intervention programmée.'),
  ('resolved',     '10000000-0000-4000-8000-000000000014', 'Travaux réalisés.'),
  ('rejected',     '10000000-0000-4000-8000-000000000013', 'Hors périmètre du dispositif.'),
  ('duplicate',    '10000000-0000-4000-8000-000000000013', 'Doublon d''un signalement existant.');

insert into public.status_changes (klash_id, changed_by, from_status, to_status, note, created_at)
select k.id, sn.actor, 'new'::public.klash_status, k.status, sn.note,
       coalesce(k.resolved_at, k.updated_at)
from public.klashes k
join seed_staff_notes sn on sn.status = k.status
where k.author_id in (select id from seed_users);

drop table seed_staff_notes;

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

-- ---------- Comments ----------
-- Word bank of short reactions a passer-by or the reporting association
-- might leave, independent of the klash titles/descriptions above.
drop table if exists seed_comment_bodies;
create temporary table seed_comment_bodies (id serial primary key, body text not null);
insert into seed_comment_bodies (body) values
  ('Toujours pas réparé à ce jour.'),
  ('Je confirme, je suis passé hier encore.'),
  ('Ça devient vraiment dangereux le soir.'),
  ('Un agent est passé constater le problème la semaine dernière.'),
  ('Même souci un peu plus loin sur le même axe.'),
  ('Merci pour le signalement, on relaie à la mairie.'),
  ('Des travaux semblent avoir commencé.'),
  ('J''ai failli tomber à cet endroit ce matin.'),
  ('Le marquage a été refait mais le problème de fond reste.'),
  ('Toujours d''actualité, à surveiller.');

-- ~700-800 comments (varies with the RNG draw) spread unevenly over klashs
-- authored by a seed user: each klash independently gets 0-3 comments
-- (weighted toward fewer — roughly a third get none, a third get 1, the
-- rest 2 or 3), which produces some empty klashs and some short threads
-- instead of a flat one-comment-per-klash distribution — closer to how a
-- real comment section looks. Each comment is posted by a different seed
-- user than the klash's
-- author (an author commenting on their own report is allowed by RLS, but
-- this keeps the seed data closer to how the feature gets used) and after
-- the klash's own created_at, with later comments in a thread further out.
-- updated_at is set equal to created_at (not left at its now() default):
-- these are freshly seeded, never-edited comments, and the detail page
-- shows a "Modifié" notice whenever updated_at differs from created_at.
insert into public.comments (klash_id, author_id, body, created_at, updated_at)
select k.id, c.author_id, c.body, k.created_at + n * c.offset_interval, k.created_at + n * c.offset_interval
from public.klashes k
cross join lateral (
  -- `where k.id is not null` correlates this subquery to the outer klash
  -- row, forcing Postgres to re-run random() once per klash instead of once
  -- for the whole query (see the identical note on `base` earlier in this
  -- file) — without it every klash ends up with the same comment_count. The
  -- single `r` draw (rather than a separate random() per `when` branch)
  -- avoids re-rolling the dice for every comparison in the case expression.
  select case
    when r < 0.35 then 0
    when r < 0.65 then 1
    when r < 0.85 then 2
    else 3
  end as comment_count
  from (select random() as r where k.id is not null) as roll
) as thread
cross join lateral generate_series(1, thread.comment_count) as n
cross join lateral (
  select
    (select id from seed_users su where su.id <> k.author_id
       order by random() limit 1) as author_id,
    (select body from seed_comment_bodies order by random() limit 1) as body,
    (floor(random() * 10) + 1) * interval '1 day'
      + (floor(random() * 24)) * interval '1 hour' as offset_interval
) as c
where k.author_id in (select id from seed_users);

drop table seed_users;
drop table seed_hubs;
drop table seed_phrases;
drop table seed_streets;
drop table seed_fillers;
drop table seed_comment_bodies;

commit;
