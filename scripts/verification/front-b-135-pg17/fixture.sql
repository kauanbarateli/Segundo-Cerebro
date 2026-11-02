-- Synthetic, isolated database only; MUST be preceded by the same-session guard.
begin;
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema app_private; create schema auth;
grant usage on schema app_private to anon,authenticated,service_role;
create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean,deleted_at timestamptz,banned_until timestamptz);
create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
create table public.user_moderation(user_id uuid primary key,status text,must_change_password boolean);
create table app_private.signup_settings(singleton boolean primary key,enabled boolean);
create table app_private.user_admission(user_id uuid primary key,origin text,state text);
create table app_private.signup_intents(id uuid primary key,user_id uuid,subject_hash text,state text,expires_at timestamptz,terms_version text,privacy_version text,origin jsonb,origin_consent_version text,origin_consented_at timestamptz);
create function app_private.signup_pending_identity(p_user uuid,p_session uuid) returns boolean language sql stable as $$
 select exists(select 1 from auth.users u join auth.sessions s on s.user_id=u.id join public.user_moderation m on m.user_id=u.id where u.id=p_user and s.id=p_session and u.email_confirmed_at is not null and not u.is_anonymous and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now()) and (s.not_after is null or s.not_after>now()) and m.status='active' and not m.must_change_password)
$$;
insert into app_private.signup_settings values(true,true);
insert into auth.users values('10000000-0000-4000-8000-000000000001',now(),false,null,null);
insert into auth.sessions values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',null);
insert into public.user_moderation values('10000000-0000-4000-8000-000000000001','active',false);
insert into app_private.user_admission values('10000000-0000-4000-8000-000000000001','unclassified','pending');
insert into app_private.signup_intents values('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',repeat('a',64),'bound',now()+interval '1 hour','terms-v1','privacy-v1','{"utm_source":"synthetic"}'::jsonb,'origin-v1',now());
commit;
