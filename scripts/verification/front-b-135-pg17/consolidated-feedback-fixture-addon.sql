-- Synthetic disposable PG17 fixture; never execute on hosted databases.
CREATE SCHEMA supabase_migrations;
CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,name text);
INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES
 ('20261007151834','identity_foundation'),
 ('20261007151850','auth_password_completion'),
 ('20261007151904','restrict_rls_event_trigger_execution'),
 ('20261007210519','capture_task_transactions'),
 ('20261007223710','activity_page');
ALTER FUNCTION app_private.require_actor(uuid,uuid) SECURITY DEFINER;
ALTER FUNCTION app_private.require_actor(uuid,uuid) SET search_path = '';
ALTER FUNCTION app_private.append_event(uuid,text,uuid,text,text,jsonb,jsonb) SECURITY DEFINER;
ALTER FUNCTION app_private.append_event(uuid,text,uuid,text,text,jsonb,jsonb) SET search_path = '';
CREATE FUNCTION app_private.session_active(p_user uuid,p_session uuid) RETURNS boolean
 LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$ SELECT true $$;
REVOKE ALL ON FUNCTION app_private.require_actor(uuid,uuid),app_private.session_active(uuid,uuid),app_private.append_event(uuid,text,uuid,text,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.onboarding_call(p_user uuid,p_session uuid,p_operation text,p_request jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
begin
 return app_private.onboarding_call(p_user,p_session,p_operation,p_request);
exception when serialization_failure then
 raise exception 'Onboarding state changed.' using errcode='PT409';
end $$;
REVOKE ALL ON FUNCTION public.onboarding_call(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.onboarding_call(uuid,uuid,text,jsonb) TO service_role;
