-- Read-only aggregate evidence, not an allowlist or a release gate.
-- PostgreSQL 16+ is required for pg_auth_members.inherit_option / set_option.
-- No role identifiers, credential values or user records are returned.
-- It intentionally reports only roles with an explicit membership path to
-- service_role; ownership, direct grants, superusers outside that path, API
-- credentials and other privilege paths require separate review.
WITH RECURSIVE target AS (
 SELECT oid FROM pg_catalog.pg_roles WHERE rolname='service_role'
), reachable(member) AS (
 SELECT m.member FROM pg_catalog.pg_auth_members m JOIN target t ON t.oid=m.roleid
 UNION
 SELECT m.member FROM pg_catalog.pg_auth_members m JOIN reachable r ON m.roleid=r.member
), direct AS (
 SELECT m.member, bool_or(m.admin_option) AS admin_option,
        bool_or(m.inherit_option) AS inherit_option, bool_or(m.set_option) AS set_option
 FROM pg_catalog.pg_auth_members m JOIN target t ON t.oid=m.roleid GROUP BY m.member
), observed AS (
 SELECT r.oid,r.rolcanlogin,r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb,r.rolinherit,
        d.member IS NOT NULL AS direct,coalesce(d.admin_option,false) AS direct_admin,
        coalesce(d.inherit_option,false) AS direct_inherit,coalesce(d.set_option,false) AS direct_set,
        pg_catalog.pg_has_role(r.oid,t.oid,'USAGE') AS usable_now,
        pg_catalog.pg_has_role(r.oid,t.oid,'SET') AS can_set_role
 FROM reachable x JOIN pg_catalog.pg_roles r ON r.oid=x.member CROSS JOIN target t
 LEFT JOIN direct d ON d.member=r.oid WHERE r.oid<>t.oid
), summary AS (
 SELECT count(*)::integer AS total,
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
 FROM observed
)
SELECT jsonb_build_object(
 'check','service_role_memberships_aggregate',
 'status',CASE WHEN NOT EXISTS(SELECT 1 FROM target) THEN 'TARGET_ABSENT'
               WHEN s.total=0 THEN 'NO_EXPLICIT_MEMBERS' ELSE 'REVIEW_REQUIRED' END,
 'counts',jsonb_build_object('total',s.total,'direct',s.direct,'transitive_only',s.transitive_only,
  'login',s.login,'superuser',s.superuser,'bypass_rls',s.bypass_rls,'create_role',s.create_role,
  'create_db',s.create_db,'role_inherit',s.role_inherit,'usable_now',s.usable_now,
  'can_set_role',s.can_set_role,'direct_admin_option',s.direct_admin_option,
  'direct_inherit_option',s.direct_inherit_option,'direct_set_option',s.direct_set_option)
) AS result FROM summary s;
