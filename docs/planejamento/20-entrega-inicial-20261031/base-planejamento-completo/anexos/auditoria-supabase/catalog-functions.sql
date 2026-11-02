BEGIN TRANSACTION READ ONLY; SET LOCAL statement_timeout='15s'; SET LOCAL lock_timeout='3s';

SELECT n.nspname AS schema, p.proname AS name, p.oid::regprocedure::text AS signature,
pg_get_function_identity_arguments(p.oid) AS arguments, pg_get_function_result(p.oid) AS result,
l.lanname AS language, p.prosecdef AS security_definer, r.rolname AS owner,
p.proconfig AS settings, p.proacl::text AS acl, md5(p.prosrc) AS source_md5,
length(p.prosrc) AS source_length,
has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
JOIN pg_language l ON l.oid=p.prolang JOIN pg_roles r ON r.oid=p.proowner
WHERE n.nspname IN ('public','app_private') AND p.prokind IN ('f','p')
ORDER BY n.nspname,p.proname,p.oid::regprocedure::text;

ROLLBACK;