-- Read-only classifier for the separately applied PT409 operational patch.
-- Run alongside release-catalog.sql; this does not turn a failed catalogue green.
begin transaction read only;
set local statement_timeout = '15s';
set local search_path = pg_catalog, public;
select jsonb_build_object(
  'check', 'onboarding_conflict_patch_pt409',
  'ok', coalesce((select
    p.prokind = 'f' and not p.proretset and p.prorettype = 'jsonb'::regtype
    and l.lanname = 'plpgsql' and p.provolatile = 'v' and not p.prosecdef
    and not p.proisstrict and not p.proleakproof and p.proparallel = 'u' and p.provariadic = 0
    and p.proconfig = array['search_path=""'] and pg_get_userbyid(p.proowner) = 'postgres'
    and p.proargnames = array['p_user','p_session','p_operation','p_request']::text[]
    and p.proargmodes is null and p.pronargdefaults = 0
    and octet_length(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')) = 198
    and encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex') = '59b03c44483704520a5300bb940111cec5c24694e6668a56b6e6574527ed021a'
    and (select count(*) from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))) = 2
    and exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where a.grantee = p.proowner and a.grantor = p.proowner and a.privilege_type = 'EXECUTE' and not a.is_grantable)
    and exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where a.grantee = 'service_role'::regrole and a.grantor = p.proowner and a.privilege_type = 'EXECUTE' and not a.is_grantable)
    and not exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where a.grantor <> p.proowner or a.is_grantable or a.privilege_type <> 'EXECUTE'
        or (a.grantee <> p.proowner and a.grantee <> 'service_role'::regrole))
    from pg_proc p join pg_language l on l.oid = p.prolang
    where p.oid = to_regprocedure('public.onboarding_call(uuid,uuid,text,jsonb)')), false)
);
rollback;
