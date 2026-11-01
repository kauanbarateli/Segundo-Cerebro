-- Synthetic signatures and grants only; not the production legacy implementation.
BEGIN;
DO $scratch_guard$ BEGIN RAISE EXCEPTION 'UNREVIEWED SCRATCH SQL: DO NOT APPLY'; END $scratch_guard$;
CREATE FUNCTION app_private.feedback_submit(uuid,uuid,uuid,text,text) RETURNS jsonb
 LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT '{}'::jsonb $$;
CREATE FUNCTION public.feedback_submit(uuid,uuid,uuid,text,text) RETURNS jsonb
 LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.feedback_submit($1,$2,$3,$4,$5) $$;
GRANT EXECUTE ON FUNCTION app_private.feedback_submit(uuid,uuid,uuid,text,text),public.feedback_submit(uuid,uuid,uuid,text,text) TO service_role;
COMMIT;
