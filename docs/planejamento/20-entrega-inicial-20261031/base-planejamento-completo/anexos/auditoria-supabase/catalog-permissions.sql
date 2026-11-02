BEGIN TRANSACTION READ ONLY; SET LOCAL statement_timeout='15s'; SET LOCAL lock_timeout='3s';

SELECT n.nspname AS schema,c.relname AS name,c.relkind,c.relrowsecurity AS rls,
c.relforcerowsecurity AS force_rls,c.relacl::text AS acl,
has_schema_privilege('anon',n.oid,'USAGE') AS anon_schema,
has_schema_privilege('authenticated',n.oid,'USAGE') AS authenticated_schema,
has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS anon_any,
has_table_privilege('authenticated',c.oid,'SELECT') AS authenticated_select,
has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS authenticated_write,
has_table_privilege('service_role',c.oid,'SELECT') AS service_select,
has_table_privilege('service_role',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS service_write
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','app_private','storage') AND c.relkind IN ('r','p','v','m')
ORDER BY n.nspname,c.relname;

ROLLBACK;