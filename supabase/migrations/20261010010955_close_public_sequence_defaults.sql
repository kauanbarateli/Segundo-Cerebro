-- 016 / T013-T028: close the platform's future public sequence grants.
-- Prepared 09/10/2026 America/Fortaleza; filename uses the UTC clock.
-- Manual application only. Preserve 001-015; never reset or seed the project.
-- This changes defaults of postgres/public/SEQUENCES only, not existing ACLs,
-- other owners, Auth/Storage defaults, table grants, functions or memberships.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
do $$ begin
 if current_user<>'postgres' or to_regclass('public.profiles') is null
  or to_regprocedure('app_private.file_cleanup_candidates()') is null then
  raise exception 'Reviewed identity/private Storage foundation and postgres owner required.';
 end if;
end $$;

-- Supabase's legacy public defaults grant SELECT/USAGE/UPDATE on future
-- sequences to API roles. App writes use narrow RPCs and UUIDs, not these grants.
-- The owner postgres retains its own privileges; other grantees are untouched.
alter default privileges for role postgres in schema public
 revoke all on sequences from public,anon,authenticated,service_role;

-- Schema defaults are added to global defaults. A schema REVOKE cannot remove
-- an unexpected global GRANT. Fail and roll back instead of silently changing
-- future objects in managed/other schemas to work around that different drift.
do $$ begin
 if exists(
  select 1 from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace
   cross join lateral aclexplode(d.defaclacl) a
  where d.defaclrole='postgres'::regrole and d.defaclobjtype='S'
   and (d.defaclnamespace=0 or n.nspname='public')
   and (a.grantee=0 or a.grantee in ('anon'::regrole,'authenticated'::regrole,'service_role'::regrole))
 ) then
  raise exception 'Sequence defaults still grant API/PUBLIC access; review global defaults separately.';
 end if;
end $$;
commit;
