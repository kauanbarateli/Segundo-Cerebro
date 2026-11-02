-- Entire fixture is synthetic and is only for a disposable PG17 container.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA app_private;
GRANT USAGE ON SCHEMA app_private TO anon,authenticated,service_role;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL);
CREATE TABLE public.user_moderation(user_id uuid PRIMARY KEY,status text NOT NULL,must_change_password boolean NOT NULL);
CREATE FUNCTION app_private.require_actor(p_user uuid,p_session uuid) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM auth.users u JOIN auth.sessions s ON s.user_id=u.id JOIN public.user_moderation m ON m.user_id=u.id
 WHERE u.id=p_user AND s.id=p_session AND m.status='active' AND NOT m.must_change_password)
 THEN RAISE EXCEPTION 'Unavailable.' USING ERRCODE='42501'; END IF;
END $$;
CREATE TABLE public.domain_events (user_id uuid,entity_type text,entity_id uuid,action text,canal text,before_data jsonb,after_data jsonb,
 CONSTRAINT domain_events_entity_type_check CHECK (((entity_type = ANY (ARRAY['profile'::text, 'preference'::text, 'module_preference'::text, 'role'::text, 'moderation'::text, 'entitlement'::text, 'authentication'::text, 'capture'::text, 'task'::text, 'finance_account'::text, 'finance_category'::text, 'finance_tag'::text, 'finance_transaction'::text, 'finance_budget'::text])) OR (entity_type = ANY (ARRAY['knowledge_notebook'::text, 'knowledge_page'::text, 'knowledge_link'::text])) OR (entity_type = ANY (ARRAY['project'::text, 'habit'::text, 'habit_entry'::text, 'habit_pause'::text, 'project_container'::text])) OR (entity_type = ANY (ARRAY['drive_folder'::text, 'drive_file'::text])) OR (entity_type = 'vault_metadata'::text) OR (entity_type = ANY (ARRAY['calendar_account'::text, 'calendar_source'::text, 'calendar_event'::text, 'calendar_sync'::text])) OR (entity_type = ANY (ARRAY['onboarding_round'::text, 'onboarding_entry'::text, 'profile_focus'::text, 'project_context'::text])) OR (entity_type = ANY (ARRAY['finance_series'::text, 'finance_series_occurrence'::text])) OR (entity_type = ANY (ARRAY['finance_goal'::text, 'finance_goal_reservation'::text, 'finance_goal_release'::text, 'finance_goal_highlight'::text])) OR (entity_type = 'finance_goal_disposition'::text))));
ALTER TABLE public.domain_events ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION app_private.append_event(p_user uuid,p_entity text,p_id uuid,p_action text,p_canal text,p_before jsonb,p_after jsonb)
RETURNS void LANGUAGE sql AS $$ INSERT INTO public.domain_events VALUES(p_user,p_entity,p_id,p_action,p_canal,p_before,p_after) $$;
INSERT INTO auth.users VALUES ('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
INSERT INTO auth.sessions VALUES ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001'),('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002');
INSERT INTO public.user_moderation VALUES ('10000000-0000-4000-8000-000000000001','active',false),('10000000-0000-4000-8000-000000000002','active',false);
