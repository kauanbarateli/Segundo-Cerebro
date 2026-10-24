-- Optional public-metadata diagnostic. Not used to accept a release.
-- No principal names, function bodies, userdata, DDL, fixtures or remote target.
begin transaction read only;
set local statement_timeout='30s';
set local lock_timeout='5s';
set local search_path=pg_catalog,public;
with redundant_owner_default_acl(object_name) as (
 -- Keep this predicate byte-identical to release-catalog.sql; the negative
 -- tests compare the SELECT body and exercise it with closed synthetic rows.
 select 'public.'||d.defaclobjtype::text from pg_default_acl d
 where d.defaclrole='postgres'::regrole and d.defaclnamespace='public'::regnamespace
  and d.defaclobjtype::text in ('r','f','S')
  and case when coalesce(cardinality(d.defaclacl),0)>0 then
   exists(select 1 from aclexplode(d.defaclacl))
   and not exists(select 1 from aclexplode(d.defaclacl) a
    where a.grantor<>d.defaclrole or a.grantee<>d.defaclrole)
   else false end
), entries as (
 select case when d.defaclnamespace=0 then 'global' else d.defaclnamespace::regnamespace::text end scope,
  d.defaclobjtype::text kind,d.defaclacl,
  (select count(*)::integer from aclexplode(d.defaclacl)) entry_count,
  (select count(*)::integer from aclexplode(d.defaclacl) a where a.grantor<>d.defaclrole) foreign_grantor_count,
  (select count(*)::integer from aclexplode(d.defaclacl) a where a.grantee<>d.defaclrole) foreign_grantee_count,
  (select count(*)::integer from aclexplode(d.defaclacl) a where a.grantee=0 or a.grantee in ('anon'::regrole,'authenticated'::regrole,'service_role'::regrole)) forbidden_entry_count
 from pg_default_acl d where d.defaclrole='postgres'::regrole and (d.defaclnamespace=0 or d.defaclnamespace in ('public'::regnamespace,'app_private'::regnamespace))
)
select jsonb_build_object('version',1,'scenario','release-default-acl-observation','rows',coalesce(jsonb_agg(jsonb_build_object(
 'scope',scope,'kind',kind,'entryCount',entry_count,'foreignGrantorCount',foreign_grantor_count,'foreignGranteeCount',foreign_grantee_count,'forbiddenEntryCount',forbidden_entry_count,
 'normalizationCandidate',scope||'.'||kind in(select object_name from redundant_owner_default_acl),
 'aclSha256',encode(sha256(convert_to(defaclacl::text,'UTF8')),'hex')) order by scope,kind),'[]'::jsonb)) from entries;
rollback;
