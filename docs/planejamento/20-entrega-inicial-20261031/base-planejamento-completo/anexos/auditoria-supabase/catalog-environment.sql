BEGIN TRANSACTION READ ONLY; SET LOCAL statement_timeout='15s'; SET LOCAL lock_timeout='3s';

SELECT current_setting('server_version') AS postgres_version,
current_setting('transaction_read_only') AS read_only,
(SELECT jsonb_agg(n.nspname ORDER BY n.nspname) FROM pg_namespace n WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema') AS schemas,
(SELECT jsonb_agg(jsonb_build_object('role',r.rolname,'schema',n.nspname,'type',d.defaclobjtype,'acl',d.defaclacl::text))
 FROM pg_default_acl d JOIN pg_roles r ON r.oid=d.defaclrole LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
 WHERE r.rolname='postgres' OR n.nspname IN ('public','app_private')) AS default_acl,
(SELECT jsonb_agg(jsonb_build_object('name',e.evtname,'event',e.evtevent,'enabled',e.evtenabled,'function',e.evtfoid::regprocedure::text)) FROM pg_event_trigger e) AS event_triggers,
(SELECT jsonb_agg(config) FROM pg_db_role_setting s CROSS JOIN LATERAL unnest(s.setconfig) config
 WHERE config LIKE 'pgrst.db_schemas=%') AS configured_api_schemas;

ROLLBACK;