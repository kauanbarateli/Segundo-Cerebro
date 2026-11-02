-- Version 1: read-only inventory evidence for review, NOT a permissions gate.
-- PostgreSQL 16+ is required for pg_auth_members.inherit_option / set_option.
-- Only the 14 observed-dashboard disclosure labels are displayed; every other
-- principal is aggregated under [outro], without OIDs, credentials or users.
-- The labels are disclosure controls, not an approved permission allowlist.
WITH RECURSIVE target AS (
 SELECT oid FROM pg_catalog.pg_roles WHERE rolname='service_role'
), reachable(member) AS (
 SELECT m.member FROM pg_catalog.pg_auth_members m JOIN target t ON t.oid=m.roleid
 UNION
 SELECT m.member FROM pg_catalog.pg_auth_members m JOIN reachable r ON m.roleid=r.member
), direct AS (
 SELECT m.member,bool_or(m.admin_option) AS admin_option,
        bool_or(m.inherit_option) AS inherit_option,bool_or(m.set_option) AS set_option
 FROM pg_catalog.pg_auth_members m JOIN target t ON t.oid=m.roleid GROUP BY m.member
), observed AS (
 SELECT CASE WHEN r.rolname IN ('anon','authenticated','authenticator','dashboard_user','pgbouncer','postgres',
        'supabase_admin','supabase_auth_admin','supabase_etl_admin','supabase_privileged_role',
        'supabase_read_only_user','supabase_realtime_admin','supabase_replication_admin','supabase_storage_admin')
        THEN r.rolname ELSE '[outro]' END AS label,
        r.rolcanlogin,r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb,r.rolinherit,
        d.member IS NOT NULL AS direct,coalesce(d.admin_option,false) AS direct_admin,
        coalesce(d.inherit_option,false) AS direct_inherit,coalesce(d.set_option,false) AS direct_set,
        pg_catalog.pg_has_role(r.oid,t.oid,'USAGE') AS usable_now,
        pg_catalog.pg_has_role(r.oid,t.oid,'SET') AS can_set_role
 FROM reachable x JOIN pg_catalog.pg_roles r ON r.oid=x.member CROSS JOIN target t
 LEFT JOIN direct d ON d.member=r.oid WHERE r.oid<>t.oid
), grouped AS (
 SELECT label,count(*)::integer AS members,
  count(*) FILTER (WHERE direct)::integer AS direct,
  count(*) FILTER (WHERE NOT direct)::integer AS transitive_only,
  count(*) FILTER (WHERE rolcanlogin)::integer AS login,
  count(*) FILTER (WHERE rolsuper)::integer AS superuser,
  count(*) FILTER (WHERE rolbypassrls)::integer AS bypass_rls,
  count(*) FILTER (WHERE rolcreaterole)::integer AS create_role,
  count(*) FILTER (WHERE rolcreatedb)::integer AS create_db,
  count(*) FILTER (WHERE rolinherit)::integer AS role_inherit,
  count(*) FILTER (WHERE usable_now)::integer AS usable_now,
  count(*) FILTER (WHERE can_set_role)::integer AS can_set_role,
  count(*) FILTER (WHERE direct_admin)::integer AS direct_admin_option,
  count(*) FILTER (WHERE direct_inherit)::integer AS direct_inherit_option,
  count(*) FILTER (WHERE direct_set)::integer AS direct_set_option
 FROM observed GROUP BY label
)
SELECT jsonb_build_object(
 'check','service_role_memberships_labeled_v1',
 'status',CASE WHEN NOT EXISTS(SELECT 1 FROM target) THEN 'TARGET_ABSENT'
               WHEN NOT EXISTS(SELECT 1 FROM observed) THEN 'NO_EXPLICIT_MEMBERS'
               ELSE 'REVIEW_REQUIRED' END,
 'roles',coalesce((SELECT jsonb_agg(jsonb_build_object(
  'label',g.label,'members',g.members,'direct',g.direct,'transitive_only',g.transitive_only,
  'login',g.login,'superuser',g.superuser,'bypass_rls',g.bypass_rls,
  'create_role',g.create_role,'create_db',g.create_db,'role_inherit',g.role_inherit,
  'usable_now',g.usable_now,'can_set_role',g.can_set_role,
  'direct_admin_option',g.direct_admin_option,'direct_inherit_option',g.direct_inherit_option,
  'direct_set_option',g.direct_set_option) ORDER BY g.label) FROM grouped g),'[]'::jsonb)
) AS result;
