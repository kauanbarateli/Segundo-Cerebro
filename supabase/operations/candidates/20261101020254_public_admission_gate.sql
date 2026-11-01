-- DRAFT ONLY. No public signup, promotion, remote application or release is authorized.
-- Requires full review of legacy cohorts, Admin and Auth recovery before promotion.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

-- Serialize the backfill and trigger installation with Auth user creation.
lock table auth.users in share row exclusive mode;
create table app_private.user_admission (
 user_id uuid primary key references auth.users(id) on delete cascade,
 origin text not null check(origin in ('legacy','admin','unclassified')),
 state text not null check(state in ('pending','admitted')),
 admitted_at timestamptz,
 check((state='admitted')=(admitted_at is not null)),
 check(state<>'admitted' or origin in ('legacy','admin'))
);
alter table app_private.user_admission enable row level security;
revoke all on app_private.user_admission from public,anon,authenticated,service_role;

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
