-- This small harness tests the Postgres/PostgREST paths used by this app.
-- It is not a replacement for testing against a hosted Supabase project.
create role anon nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon, service_role;
alter default privileges in schema public grant select on tables to anon;
alter default privileges in schema public grant all on tables to service_role;
