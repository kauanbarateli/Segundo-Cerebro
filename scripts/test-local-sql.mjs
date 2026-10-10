/** Local, disposable PostgreSQL. Auth is an explicit fixture, not Supabase Auth.
 * No connection string, environment secrets, remote connection or persistent data.
 * This script must never become a deploy/schema-application step.
 */
import { readFile, readdir } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { inspectLocalPublicDatabaseContracts } from "./operations/database-contracts.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const db = new PGlite({ extensions: { pgcrypto, pg_trgm } });
let current = "local Auth fixture";
try {
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create schema extensions; create schema storage;
    create extension pgcrypto with schema extensions;
    create table auth.users (
      id uuid primary key, aud text, role text, email text unique, encrypted_password text,
      email_confirmed_at timestamptz, confirmed_at timestamptz, last_sign_in_at timestamptz,
      is_anonymous boolean not null default false, deleted_at timestamptz, banned_until timestamptz,
      raw_user_meta_data jsonb not null default '{}', raw_app_meta_data jsonb not null default '{}',
      created_at timestamptz default now(), updated_at timestamptz default now());
    create table auth.sessions (id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz,created_at timestamptz default now(),updated_at timestamptz default now());
    create table auth.refresh_tokens (id bigserial primary key,user_id text,session_id uuid references auth.sessions(id) on delete cascade,token text,revoked boolean default false,created_at timestamptz default now(),updated_at timestamptz default now());
    create function auth.jwt() returns jsonb language sql stable as $f$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $f$;
    create function auth.uid() returns uuid language sql stable as $f$ select nullif(auth.jwt()->>'sub','')::uuid $f$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on function auth.uid(),auth.jwt() to anon,authenticated,service_role;
    -- Storage catalogue fixture only: no HTTP service or stored object bytes.
    create table storage.buckets (id text primary key,name text not null,public boolean not null default false,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text not null,owner uuid,owner_id text,metadata jsonb);
    alter table storage.buckets enable row level security; alter table storage.objects enable row level security;
    grant usage on schema storage to anon,authenticated,service_role;
    grant select,insert,update,delete on storage.buckets,storage.objects to anon,authenticated,service_role;
    -- Fixture for the hosted infrastructure contract required by historical
    -- migration 3. Its body is local test infrastructure, not hosted evidence.
    create function public.rls_auto_enable() returns event_trigger language plpgsql security definer set search_path=pg_catalog as $f$
    declare row record; begin
      for row in select c.objid from pg_event_trigger_ddl_commands() c join pg_class t on t.oid=c.objid join pg_namespace n on n.oid=t.relnamespace where c.object_type='table' and n.nspname in ('public','app_private') loop
        execute format('alter table %s enable row level security',row.objid::regclass);
      end loop;
    end $f$;
    create event trigger ensure_rls on ddl_command_end when tag in ('CREATE TABLE','CREATE TABLE AS','SELECT INTO') execute function public.rls_auto_enable();
  `);
  const files = (await readdir(resolve(root, "supabase/migrations"))).filter(name => /^\d{14}_.+\.sql$/.test(name)).sort();
  for (const file of files) {
    current = file;
    const source = await readFile(resolve(root, "supabase/migrations", file), "utf8");
    if (!source.trim()) throw new Error("Empty migration cannot pass release validation.");
    await db.exec(source); process.stdout.write(`PASS migration ${file}\n`);
  }
  current = "committed public database contracts";
  const contracts = await inspectLocalPublicDatabaseContracts(db, await readFile(resolve(root, "src/lib/supabase/database.generated.ts"), "utf8"));
  process.stdout.write(`PASS local generated contracts ${contracts.tables} tables, ${contracts.views} views, ${contracts.rpcs} RPCs, ${contracts.columns} columns, ${contracts.arguments} arguments\n`);
  const requested = process.argv.slice(2);
  const tests = requested.length ? requested : (await readdir(resolve(root, "supabase/tests"))).filter(name => name.endsWith(".sql") && name !== "global-search-performance.sql").sort().map(name => "supabase/tests/" + name);
  for (const file of tests) {
    const path = resolve(root, file);
    if (!path.startsWith(resolve(root, "supabase/tests") + "/") && !path.startsWith(resolve(root, "supabase/tests") + "\\")) throw new Error("Only versioned SQL assertions are allowed.");
    current = basename(file); const results = await db.exec(await readFile(path, "utf8"));
    if (current === "release-catalog.sql") {
      const report = results.flatMap(result => result.rows).map(row => row.jsonb_build_object).find(value => value && typeof value === "object" && value.version === 1);
      if (!report || report.ok !== true || !Array.isArray(report.deviations) || report.deviations.length) throw new Error("Release catalogue deviations: " + JSON.stringify(report?.deviations ?? ["missing metadata report"]));
      process.stdout.write(`PASS catalogue ${report.checks} read-only checks, zero deviations\n`);
    }
    if (current === "global-search-performance.sql") {
      const metrics = results.flatMap(result => result.rows).filter(row => typeof row.term === "string" && typeof row.within_recommended_budget === "boolean");
      process.stdout.write(JSON.stringify(metrics) + "\n");
      if (metrics.length !== 6 || metrics.some(row => !row.within_recommended_budget)) throw new Error("Search exceeded the recommended local budget of 500 ms.");
    }
    process.stdout.write(`PASS assertions ${current}\n`);
  }
  const { rows } = await db.query("select count(*)::integer as users from auth.users");
  if (rows[0].users !== 0) throw new Error("Assertions left synthetic Auth rows; rollback is mandatory.");
  process.stdout.write("Disposable local SQL validation passed. No remote SQL executed; real Auth/Storage/concurrency still require separate validation.\n");
} catch (error) {
  // Error data only references versioned synthetic input, never app secrets.
  process.stderr.write(`FAIL ${current}: ${error.message}\n${error.detail ?? ""}\n${error.where ?? ""}\n`);
  process.exitCode = 1;
} finally { await db.close(); }
