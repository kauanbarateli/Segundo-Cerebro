-- DRAFT ONLY. No public signup, promotion, remote application or release is authorized.
-- Requires full review of legacy cohorts, Admin and Auth recovery before promotion.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

-- Serialize the backfill and trigger installation with Auth user creation.
lock table auth.users in share row exclusive mode;
-- Do not silently remove access from a previously active unconfirmed identity.
-- Resolve that cohort with a separately reviewed plan before promotion.
do $$ begin
 if exists(select 1 from auth.users u join auth.sessions s on s.user_id=u.id
  join public.user_moderation m on m.user_id=u.id
  where u.email_confirmed_at is null and not u.is_anonymous and u.deleted_at is null
   and (u.banned_until is null or u.banned_until<=now()) and (s.not_after is null or s.not_after>now())
   and m.status='active' and not m.must_change_password
   and not exists(select 1 from app_private.admin_operations o where o.target_user_id=u.id and o.command='admin.user.create' and o.phase='complete'))
  then raise exception 'Existing active unconfirmed identity requires review.' using errcode='23514'; end if;
end $$;
create table app_private.user_admission (
 user_id uuid primary key references auth.users(id) on delete cascade,
 origin text not null check(origin in ('legacy','admin','public','unclassified')),
 state text not null check(state in ('pending','admitted')),
 admitted_at timestamptz,
 check((state='admitted')=(admitted_at is not null)),
 check(state<>'admitted' or origin in ('legacy','admin','public'))
);
alter table app_private.user_admission enable row level security;
revoke all on app_private.user_admission from public,anon,authenticated,service_role;

-- Absence of a setting is closed. Enabling requires a separate reviewed operation.
create table app_private.signup_settings (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false
);
alter table app_private.signup_settings enable row level security;
revoke all on app_private.signup_settings from public,anon,authenticated,service_role;

-- The binding pointer is an opaque random secret, stored here only as SHA-256.
-- The subject is a server-created HMAC, never an email or a client authority.
create table app_private.signup_intents (
 id uuid primary key default gen_random_uuid(),
 binding_hash text not null unique check(binding_hash ~ '^[a-f0-9]{64}$'),
 subject_hash text not null check(subject_hash ~ '^[a-f0-9]{64}$'),
 terms_version text not null check(char_length(terms_version) between 1 and 100),
 privacy_version text not null check(char_length(privacy_version) between 1 and 100),
 expires_at timestamptz not null,
 state text not null default 'pending' check(state in ('pending','bound','consumed')),
 user_id uuid unique references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 check((state='pending')=(user_id is null))
);
alter table app_private.signup_intents enable row level security;
revoke all on app_private.signup_intents from public,anon,authenticated,service_role;

create function app_private.signup_intent_create(p_binding_hash text,p_subject_hash text,p_terms text,p_privacy text,p_expires timestamptz) returns uuid
language plpgsql security definer set search_path='' as $$ declare v_id uuid; begin
 perform 1 from app_private.signup_settings where singleton and enabled for share;
 if not found then raise exception 'Signup unavailable.' using errcode='42501'; end if;
 if p_binding_hash is null or p_binding_hash !~ '^[a-f0-9]{64}$' or p_subject_hash is null or p_subject_hash !~ '^[a-f0-9]{64}$'
  or p_terms is null or char_length(p_terms) not between 1 and 100 or p_privacy is null or char_length(p_privacy) not between 1 and 100
  or p_expires is null or p_expires<=now() or p_expires>now()+interval '1 hour' then
  raise exception 'Invalid signup intent.' using errcode='22023';
 end if;
 insert into app_private.signup_intents(binding_hash,subject_hash,terms_version,privacy_version,expires_at)
 values(p_binding_hash,p_subject_hash,p_terms,p_privacy,p_expires) returning id into v_id;
 return v_id;
end $$;
create function public.signup_intent_create(p_binding_hash text,p_subject_hash text,p_terms text,p_privacy text,p_expires timestamptz) returns uuid
language sql security invoker set search_path='' as $$ select app_private.signup_intent_create(p_binding_hash,p_subject_hash,p_terms,p_privacy,p_expires) $$;
revoke all on function app_private.signup_intent_create(text,text,text,text,timestamptz),public.signup_intent_create(text,text,text,text,timestamptz) from public,anon,authenticated,service_role;
grant execute on function app_private.signup_intent_create(text,text,text,text,timestamptz),public.signup_intent_create(text,text,text,text,timestamptz) to service_role;

-- Only a trusted confirmation channel may attest that the email holder has
-- explicitly set a password after OTP verification. This table alone is not proof.
create table app_private.signup_password_proofs (
 intent_id uuid primary key references app_private.signup_intents(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 session_id uuid not null references auth.sessions(id) on delete cascade,
 expires_at timestamptz not null, consumed_at timestamptz
);
alter table app_private.signup_password_proofs enable row level security;
revoke all on app_private.signup_password_proofs from public,anon,authenticated,service_role;

-- Expand the origin contract. Existing verified Admin inserts continue to use
-- their non-null operation and default origin; a public origin needs an intent.
alter table app_private.onboarding_entries alter column source_operation drop not null;
alter table app_private.onboarding_entries add column source_kind text not null default 'admin';
alter table app_private.onboarding_entries add column source_intent uuid unique references app_private.signup_intents(id);
alter table app_private.onboarding_entries add constraint onboarding_entry_source_check check(
 (source_kind='admin' and source_operation is not null and source_intent is null) or
 (source_kind='public' and source_operation is null and source_intent is not null)
);

do $$ declare expression text; begin
 select pg_get_expr(conbin,conrelid) into strict expression from pg_constraint
  where conrelid='public.domain_events'::regclass and conname='domain_events_entity_type_check';
 alter table public.domain_events drop constraint domain_events_entity_type_check;
 execute format('alter table public.domain_events add constraint domain_events_entity_type_check check ((%s) or entity_type = ''signup_admission'')',expression);
end $$;

-- For pending users only: validate session and moderation without granting
-- module access. No user-controlled metadata participates in this predicate.
create function app_private.signup_pending_identity(p_user uuid,p_session uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select p_user is not null and p_session is not null and exists(
  select 1 from auth.users u join auth.sessions s on s.user_id=u.id
  join public.user_moderation m on m.user_id=u.id
  where u.id=p_user and s.id=p_session and u.email_confirmed_at is not null
   and not u.is_anonymous and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
   and (s.not_after is null or s.not_after>now()) and m.status='active' and not m.must_change_password
 );
$$;
revoke all on function app_private.signup_pending_identity(uuid,uuid) from public,anon,authenticated,service_role;

create function app_private.signup_attest_password_reset(p_user uuid,p_session uuid,p_intent uuid,p_subject_hash text) returns void
language plpgsql security definer set search_path='' as $$ declare i app_private.signup_intents; begin
 perform 1 from auth.users where id=p_user for share;
 perform 1 from auth.sessions where id=p_session and user_id=p_user for share;
 perform 1 from public.user_moderation where user_id=p_user for share;
 if not app_private.signup_pending_identity(p_user,p_session) then raise exception 'Signup unavailable.' using errcode='42501'; end if;
 perform 1 from app_private.signup_settings where singleton and enabled for share;
 if not found then raise exception 'Signup unavailable.' using errcode='42501'; end if;
 select * into i from app_private.signup_intents where id=p_intent for update;
 if not found or i.user_id is distinct from p_user or i.state<>'bound' or i.expires_at<=now() or i.subject_hash is distinct from p_subject_hash
  then raise exception 'Signup unavailable.' using errcode='42501'; end if;
 insert into app_private.signup_password_proofs(intent_id,user_id,session_id,expires_at)
 values(i.id,p_user,p_session,least(i.expires_at,now()+interval '10 minutes'))
 on conflict(intent_id) do update set user_id=excluded.user_id,session_id=excluded.session_id,expires_at=excluded.expires_at,consumed_at=null
 where app_private.signup_password_proofs.consumed_at is null;
 if not found then raise exception 'Signup unavailable.' using errcode='42501'; end if;
end $$;
create function public.signup_attest_password_reset(p_user uuid,p_session uuid,p_intent uuid,p_subject_hash text) returns void
language sql security invoker set search_path='' as $$ select app_private.signup_attest_password_reset(p_user,p_session,p_intent,p_subject_hash) $$;

create function app_private.signup_complete(p_user uuid,p_session uuid,p_intent uuid,p_subject_hash text,p_terms text,p_privacy text) returns jsonb
language plpgsql security definer set search_path='' as $$ declare i app_private.signup_intents; a app_private.user_admission; begin
 perform 1 from auth.users where id=p_user for share;
 perform 1 from auth.sessions where id=p_session and user_id=p_user for share;
 perform 1 from public.user_moderation where user_id=p_user for share;
 if not app_private.signup_pending_identity(p_user,p_session) then raise exception 'Signup unavailable.' using errcode='42501'; end if;
 select * into i from app_private.signup_intents where id=p_intent for update;
 if not found or i.user_id is distinct from p_user or i.subject_hash is distinct from p_subject_hash or i.terms_version is distinct from p_terms or i.privacy_version is distinct from p_privacy
  then raise exception 'Signup unavailable.' using errcode='42501'; end if;
 select * into a from app_private.user_admission where user_id=p_user for update;
 if not found then raise exception 'Signup unavailable.' using errcode='42501'; end if;
 if i.state='consumed' and a.origin='public' and a.state='admitted' then return jsonb_build_object('status','already_admitted'); end if;
 perform 1 from app_private.signup_settings where singleton and enabled for share;
 if not found then raise exception 'Signup unavailable.' using errcode='42501'; end if;
 if i.state<>'bound' or i.expires_at<=now() or a.origin<>'unclassified' or a.state<>'pending' or not exists(
  select 1 from app_private.signup_password_proofs p where p.intent_id=i.id and p.user_id=p_user and p.session_id=p_session and p.consumed_at is null and p.expires_at>now()
 ) then raise exception 'Signup unavailable.' using errcode='42501'; end if;
 update app_private.signup_password_proofs set consumed_at=now() where intent_id=i.id;
 update app_private.signup_intents set state='consumed' where id=i.id;
 update app_private.user_admission set origin='public',state='admitted',admitted_at=now() where user_id=p_user;
 insert into app_private.onboarding_entries(user_id,source_operation,source_kind,source_intent) values(p_user,null,'public',i.id);
 perform app_private.append_event(p_user,'signup_admission',p_user,'created','web',null,jsonb_build_object('user_id',p_user,'origin','public'));
 perform app_private.append_event(p_user,'onboarding_entry',p_user,'created','web',null,jsonb_build_object('user_id',p_user,'eligibility','new_explicit','schema_version',1));
 return jsonb_build_object('status','admitted');
end $$;
create function public.signup_complete(p_user uuid,p_session uuid,p_intent uuid,p_subject_hash text,p_terms text,p_privacy text) returns jsonb
language sql security invoker set search_path='' as $$ select app_private.signup_complete(p_user,p_session,p_intent,p_subject_hash,p_terms,p_privacy) $$;
revoke all on function app_private.signup_attest_password_reset(uuid,uuid,uuid,text),public.signup_attest_password_reset(uuid,uuid,uuid,text),app_private.signup_complete(uuid,uuid,uuid,text,text,text),public.signup_complete(uuid,uuid,uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function app_private.signup_attest_password_reset(uuid,uuid,uuid,text),public.signup_attest_password_reset(uuid,uuid,uuid,text),app_private.signup_complete(uuid,uuid,uuid,text,text,text),public.signup_complete(uuid,uuid,uuid,text,text,text) to service_role;

-- Historical confirmed identities retain access; unconfirmed, non-Admin users
-- remain pending until a separately reviewed proof-of-possession flow exists.
insert into app_private.user_admission(user_id,origin,state,admitted_at)
select u.id,
 case when exists(select 1 from app_private.admin_operations o where o.target_user_id=u.id and o.command='admin.user.create' and o.phase='complete') then 'admin'
      when u.email_confirmed_at is not null then 'legacy' else 'unclassified' end,
 case when u.email_confirmed_at is not null or exists(select 1 from app_private.admin_operations o where o.target_user_id=u.id and o.command='admin.user.create' and o.phase='complete') then 'admitted' else 'pending' end,
 case when u.email_confirmed_at is not null or exists(select 1 from app_private.admin_operations o where o.target_user_id=u.id and o.command='admin.user.create' and o.phase='complete') then now() else null end
from auth.users u;

create function app_private.admission_new_identity() returns trigger
language plpgsql security definer set search_path='' as $$ declare pointer text; begin
 insert into app_private.user_admission(user_id,origin,state) values(new.id,'unclassified','pending');
 -- Binding is possible only during the INSERT of a newly created Auth identity;
 -- subsequent metadata updates or a duplicate signup cannot bind an old account.
 pointer:=new.raw_user_meta_data->>'sc_signup_pointer';
 if pointer is not null and pointer ~ '^[A-Za-z0-9_-]{43,128}$' then
  update app_private.signup_intents set state='bound',user_id=new.id
   where binding_hash=encode(sha256(convert_to(pointer,'UTF8')),'hex') and state='pending' and expires_at>now();
 end if;
 -- Remove the transient pointer from this INSERT snapshot; Auth integration must
 -- verify GoTrue does not subsequently restore it before using this candidate.
 if new.raw_user_meta_data ? 'sc_signup_pointer' then
  update auth.users set raw_user_meta_data=raw_user_meta_data-'sc_signup_pointer' where id=new.id;
 end if;
 return new;
end $$;
revoke all on function app_private.admission_new_identity() from public,anon,authenticated,service_role;
create trigger second_brain_admission_created after insert on auth.users for each row execute function app_private.admission_new_identity();

-- The existing verified Admin saga supplies its own origin; no public metadata
-- or email comparison is authority to admit a user.
create function app_private.admission_admin_completed() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 if new.command='admin.user.create' and new.phase='complete' and old.phase<>'complete' then
  if not exists(select 1 from auth.users u where u.id=new.target_user_id and u.raw_app_meta_data->>'sc_admin_operation'=new.operation_id::text)
   then raise exception 'Unverified administrative admission.' using errcode='23514'; end if;
  update app_private.user_admission set origin='admin',state='admitted',admitted_at=now()
   where user_id=new.target_user_id and origin='unclassified' and state='pending';
  if not found and not exists(select 1 from app_private.user_admission where user_id=new.target_user_id and origin='admin' and state='admitted')
   then raise exception 'Administrative admission unavailable.' using errcode='23514'; end if;
 end if;
 return new;
end $$;
revoke all on function app_private.admission_admin_completed() from public,anon,authenticated,service_role;
create trigger admission_verified_admin_completion after update of phase on app_private.admin_operations
for each row execute function app_private.admission_admin_completed();

-- Expand the shared session predicate; moderation and existing entitlements stay independent.
create or replace function app_private.session_active(p_user uuid,p_session uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select p_user is not null and p_session is not null and exists (
  select 1 from auth.sessions s join auth.users u on u.id=s.user_id
  join public.user_moderation m on m.user_id=u.id
  join app_private.user_admission a on a.user_id=u.id and a.state='admitted'
  where s.id=p_session and s.user_id=p_user and m.status='active'
   and not u.is_anonymous and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
   and (s.not_after is null or s.not_after>now())
 );
$$;
commit;
