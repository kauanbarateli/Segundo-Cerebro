-- Synthetic in-memory fixture only. Not Supabase, not a migration.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE SCHEMA app_private;
-- Expose schema usage only to exercise object-specific denials in the fixture.
GRANT USAGE ON SCHEMA app_private TO anon,authenticated,service_role;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL);
CREATE TABLE public.user_moderation(user_id uuid PRIMARY KEY,status text NOT NULL,must_change_password boolean NOT NULL);
CREATE FUNCTION app_private.require_actor(p_user uuid,p_session uuid) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM auth.users u JOIN auth.sessions s ON s.user_id=u.id JOIN public.user_moderation m ON m.user_id=u.id
 WHERE u.id=p_user AND s.id=p_session AND m.status='active' AND NOT m.must_change_password)
 THEN RAISE EXCEPTION 'Unavailable.' USING ERRCODE='42501'; END IF;
END $$;
CREATE TABLE app_private.feedback_requests (
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),user_id uuid NOT NULL,client_id uuid NOT NULL,
 category text NOT NULL,message text NOT NULL,created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
 UNIQUE(user_id,client_id)
);
CREATE TABLE public.domain_events (user_id uuid,entity_type text,entity_id uuid,action text,canal text,before_data jsonb,after_data jsonb);
CREATE FUNCTION app_private.append_event(p_user uuid,p_entity text,p_id uuid,p_action text,p_canal text,p_before jsonb,p_after jsonb)
RETURNS void LANGUAGE sql AS $$ INSERT INTO public.domain_events VALUES(p_user,p_entity,p_id,p_action,p_canal,p_before,p_after) $$;
