-- Removes everything created by one manual preview test of the creation flow
-- (step 4 onward): the klashs, confirmations and auth account for a single
-- test email. Previews point at the production Supabase project (see
-- README.md § "Previews et base de données"), so testing "signaler un
-- klash" from a phone against a preview URL creates a real row in
-- production — this is the cleanup for that, run by hand after each such
-- test. Distinct from scripts/cleanup-seed-data.sql, which targets the 12
-- fixed seed-user ids only and must not be touched to also cover this case.
--
-- Usage (bare value, no quotes — psql's :'email' form quotes it for SQL;
-- double-quoting here would pass the literal quote characters through):
--   psql "$(npx supabase status -o env --linked | grep DB_URL | cut -d= -f2-)" \
--     -v email=your-test-address@example.com \
--     -f scripts/cleanup-test-klash.sql

begin;

create temporary table test_user_id as
select id from auth.users where email = :'email';

-- do $$ ... $$ bodies are dollar-quoted, so psql's :'email' substitution
-- (which only rewrites the raw SQL text) doesn't reach inside one — the
-- email is passed in through the temp table above instead, not re-read here.
do $$
begin
  if (select count(*) from test_user_id) = 0 then
    raise exception 'no matching auth.users row for the given email';
  end if;
end;
$$;

update public.klashes set duplicate_of = null
 where author_id in (select id from test_user_id);
delete from public.confirmations
 where user_id in (select id from test_user_id)
    or klash_id in (select id from public.klashes where author_id in (select id from test_user_id));
delete from public.klashes where author_id in (select id from test_user_id);
delete from auth.users where id in (select id from test_user_id); -- cascades profiles

drop table test_user_id;

commit;
