-- Synthetic database only, after the existing same-session offline guard.
begin;
create role anon; create role authenticated; create role service_role;
create schema app_private; create schema auth;
grant usage on schema app_private to service_role;
create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean,deleted_at timestamptz,banned_until timestamptz,raw_user_meta_data jsonb);
create table auth.sessions(id uuid primary key,user_id uuid not null,not_after timestamptz);
create table public.user_moderation(user_id uuid primary key,status text,must_change_password boolean);
create table app_private.signup_settings(singleton boolean primary key,enabled boolean);
create table app_private.user_admission(user_id uuid primary key references auth.users(id) on delete cascade,origin text,state text,admitted_at timestamptz);
create table app_private.signup_intents(id uuid primary key default gen_random_uuid(),binding_hash text unique,subject_hash text,terms_version text,privacy_version text,expires_at timestamptz,state text default 'pending',user_id uuid unique,origin jsonb,origin_consent_version text,origin_consented_at timestamptz,consumed_at timestamptz);
create table app_private.signup_completion_fences_draft(user_id uuid primary key,intent_id uuid,origin_withdrawn boolean default false,origin_expired boolean default false,updated_at timestamptz default now(),owner_session_id uuid,request_id uuid,generation uuid,phase text,terms_version text,privacy_version text,origin_accepted boolean default false,origin_consent_version text);
create table app_private.signup_origins(user_id uuid primary key,origin jsonb,consent_version text,consented_at timestamptz,expires_at timestamptz);
create table app_private.events(user_id uuid,entity text);
create function app_private.append_event(p uuid,e text,i uuid,a text,s text,n uuid,b jsonb) returns void language sql as $$ insert into app_private.events values(p,e) $$;
create function app_private.valid_signup_origin(o jsonb) returns boolean language sql as $$ select jsonb_typeof(o)='object' $$;
insert into app_private.signup_settings values(true,false);
commit;
