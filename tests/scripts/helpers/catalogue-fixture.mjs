import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

// Explicit hosted-catalogue fixtures in memory; no Auth service, object bytes,
// credentials, connections or user seeds. Discard the whole DB after the test.
const INFRASTRUCTURE = `
 create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
 create schema auth; create schema extensions; create schema storage;
 create extension pgcrypto with schema extensions;
 create table auth.users (
  id uuid primary key, aud text, role text, email text unique, encrypted_password text,
  email_confirmed_at timestamptz, confirmed_at timestamptz, last_sign_in_at timestamptz,
  is_anonymous boolean not null default false, deleted_at timestamptz, banned_until timestamptz,
  raw_user_meta_data jsonb not null default '{}', raw_app_meta_data jsonb not null default '{}',
  created_at timestamptz default now(), updated_at timestamptz default now());
 create table auth.sessions (id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,
  not_after timestamptz,created_at timestamptz default now(),updated_at timestamptz default now());
 create table auth.refresh_tokens (id bigserial primary key,user_id text,session_id uuid references auth.sessions(id) on delete cascade,
  token text,revoked boolean default false,created_at timestamptz default now(),updated_at timestamptz default now());
 create function auth.jwt() returns jsonb language sql stable as $f$
  select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $f$;
 create function auth.uid() returns uuid language sql stable as $f$ select nullif(auth.jwt()->>'sub','')::uuid $f$;
 grant usage on schema auth to anon,authenticated,service_role;
 grant execute on function auth.uid(),auth.jwt() to anon,authenticated,service_role;
 create table storage.buckets (id text primary key,name text not null,public boolean not null default false,
  file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects (id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),
  name text not null,owner uuid,owner_id text,metadata jsonb);
 alter table storage.buckets enable row level security; alter table storage.objects enable row level security;
 grant usage on schema storage to anon,authenticated,service_role;
 grant select,insert,update,delete on storage.buckets,storage.objects to anon,authenticated,service_role;
 create function public.rls_auto_enable() returns event_trigger language plpgsql security definer set search_path=pg_catalog as $f$
 declare row record;begin
  for row in select c.objid from pg_event_trigger_ddl_commands() c join pg_class t on t.oid=c.objid
   join pg_namespace n on n.oid=t.relnamespace where c.object_type='table' and n.nspname in ('public','app_private') loop
   execute format('alter table %s enable row level security',row.objid::regclass);
  end loop;
 end $f$;
 create event trigger ensure_rls on ddl_command_end when tag in ('CREATE TABLE','CREATE TABLE AS','SELECT INTO')
  execute function public.rls_auto_enable();
`;

export async function createCatalogueFixture() {
 const db = new PGlite({ extensions: { pgcrypto, pg_trgm } });
 try { await db.exec(INFRASTRUCTURE); return db; }
 catch (error) { await db.close(); throw error; }
}
