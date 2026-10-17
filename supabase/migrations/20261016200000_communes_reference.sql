-- Reference table of French communes: INSEE code, name, EPCI (intercommunalité)
-- and boundary. It exists so the database, not a client, can say in which
-- commune a klash is (see 20261016200100_klash_admin_area.sql).
--
-- Schema only. The rows are loaded by a generated migration
-- (scripts/build-communes-migration.mjs), once per COG year: communes merge
-- and split every January, so a new vintage is a new migration, never an
-- edit of an applied one. Clients can only read.

create table public.communes (
  insee_code char(5) primary key
    check (insee_code ~ '^([0-9]{2}|2[AB])[0-9]{3}$'),
  name       text not null check (char_length(name) between 1 and 120),
  epci_siren char(9) check (epci_siren ~ '^[0-9]{9}$'),
  epci_name  text,
  cog_year   smallint not null,
  geom       extensions.geometry(MultiPolygon, 4326) not null
);

create index communes_geom_idx on public.communes using gist (geom);

alter table public.communes enable row level security;

create policy communes_select_all on public.communes
  for select using (true);

-- Defence in depth: the default privileges grant everything on new tables to
-- the API roles, and TRUNCATE is not subject to RLS.
revoke insert, update, delete, truncate on public.communes from anon, authenticated;
