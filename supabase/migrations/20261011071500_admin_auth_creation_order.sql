-- 018 / T017: GoTrue inserts Auth before updating app_metadata and ban_duration.
-- Preserve 001-017. Reviewed application only; no users, seeds or grants added.
-- Timestamp is this migration's ordered identifier, not an application record.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $$ begin
 if current_user<>'postgres'
  or to_regclass('auth.users') is null or to_regclass('auth.sessions') is null
  or to_regclass('auth.refresh_tokens') is null
  or to_regclass('app_private.admin_operations') is null
  or to_regclass('public.user_roles') is null or to_regclass('public.user_moderation') is null
  or to_regprocedure('app_private.provision_user(uuid)') is null
  or to_regprocedure('app_private.append_event(uuid,text,uuid,text,text,jsonb,jsonb)') is null
  or not exists(select 1 from pg_proc p where p.oid=to_regprocedure('app_private.on_auth_user_created()')
    and p.prorettype='trigger'::regtype and p.prosecdef and pg_get_userbyid(p.proowner)='postgres'
    and encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')=
     'cabf8349037c8d23694a83299d3a81ae08131fcd9f2a58e4118225e91ee728f4')
  or not exists(select 1 from pg_trigger t where t.tgrelid='auth.users'::regclass
    and t.tgname='second_brain_identity_created' and not t.tgisinternal
    and t.tgtype=5 and t.tgenabled='O'
    and t.tgfoid=to_regprocedure('app_private.on_auth_user_created()')) then
  raise exception 'Reviewed administrative Auth foundation and postgres owner required.';
 end if;
 if to_regprocedure('app_private.check_admin_auth_creation_final()') is not null
  or exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass
    and tgname='second_brain_admin_creation_final') then
  raise exception 'Administrative Auth creation-order migration is already present.';
 end if;
end $$;

-- The exact server-generated reserved UUID applies the fence immediately.
-- GoTrue's uncommitted INSERT has only provider/providers; its later UPDATEs
-- set sc_admin_operation and banned_until before the same transaction commits.
create or replace function app_private.on_auth_user_created() returns trigger
language plpgsql security definer set search_path='' as $$
declare op app_private.admin_operations; begin
 perform app_private.provision_user(new.id);
 select * into op from app_private.admin_operations
  where target_user_id=new.id and command='admin.user.create' and phase<>'complete';
 if found then
  update public.user_moderation set status='blocked',must_change_password=true,
   changed_by=op.actor_user_id,changed_at=now(),reason='admin_creation_pending' where user_id=new.id;
  perform app_private.append_event(new.id,'moderation',new.id,'status_changed','api',null,
   jsonb_build_object('user_id',new.id,'status','blocked','must_change_password',true));
 end if;
 return new;
end $$;

-- NEW is the INSERT snapshot, not the final row after GoTrue's UPDATEs.
-- Read the final row at commit; an invalid reservation remains unchanged and
-- the complete Auth transaction, provisioning and metadata events roll back.
create function app_private.check_admin_auth_creation_final() returns trigger
language plpgsql security definer set search_path='' as $$
declare op app_private.admin_operations; begin
 select * into op from app_private.admin_operations
  where target_user_id=new.id and command='admin.user.create' and phase<>'complete';
 if not found then return new; end if;
 if op.active_execution is null
  or not exists(select 1 from auth.users u
   join public.user_roles r on r.user_id=u.id
   join public.user_moderation m on m.user_id=u.id
   where u.id=new.id and u.raw_app_meta_data->>'sc_admin_operation'=op.operation_id::text
    and u.role='authenticated' and not u.is_anonymous and u.deleted_at is null
    and u.banned_until>now() and r.role='user'
    and m.status='blocked' and m.must_change_password
    and m.changed_by=op.actor_user_id and m.reason='admin_creation_pending')
  or exists(select 1 from auth.sessions where user_id=new.id)
  or exists(select 1 from auth.refresh_tokens where user_id::text=new.id::text) then
  raise exception 'Reserved Auth creation final state is not confirmed.' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function app_private.check_admin_auth_creation_final() from public,anon,authenticated,service_role;
create constraint trigger second_brain_admin_creation_final after insert on auth.users
 deferrable initially deferred for each row execute function app_private.check_admin_auth_creation_final();
comment on function app_private.check_admin_auth_creation_final() is
 'Checks final reserved Auth creation at commit; metadata never grants a role or releases moderation.';
commit;
