-- SPEC-08 #75: disposable runner assertions; never an automatic remote migration.
begin;
do $$ declare definition text;begin
 if not has_function_privilege('service_role','public.capture_task_commit(uuid,uuid,text,jsonb)','execute')
  or has_function_privilege('authenticated','public.capture_task_commit(uuid,uuid,text,jsonb)','execute')
  or has_function_privilege('anon','public.capture_task_commit(uuid,uuid,text,jsonb)','execute') then raise exception 'Capture commit grants changed.';end if;
 if has_function_privilege('service_role','app_private.capture_document_validate(jsonb)','execute')
  or has_function_privilege('authenticated','app_private.capture_document_commit_transition(text,jsonb,jsonb)','execute')
  or has_function_privilege('anon','app_private.capture_document_fingerprint_limit(text,jsonb)','execute') then raise exception 'Document internals were exposed.';end if;
 if to_regprocedure('app_private.capture_task_validate_payload_v1(text,jsonb)') is null
  or to_regprocedure('app_private.capture_task_validate_payload_spec08_previous(text,jsonb)') is null
  or to_regprocedure('app_private.capture_task_validate_payload_capture_document_previous(text,jsonb)') is null then raise exception 'Installed validation chain lost.';end if;
 select pg_get_functiondef('app_private.capture_task_commit(uuid,uuid,text,jsonb)'::regprocedure) into definition;
 if strpos(definition,'capture_document_fingerprint_limit(p_operation,r)')=0 or strpos(definition,'octet_length(p_request::text)>8388608')=0
  or strpos(definition,'octet_length((r->''result'')::text)>1048576')=0 then raise exception 'Discriminated/global limits changed.';end if;
 if strpos(definition,'capture_task_guard(p_user,p_session,p_operation)')>strpos(definition,'select * into receipt')
  or strpos(definition,'select * into receipt')>strpos(definition,'current_revision:=')
  or strpos(definition,'current_revision:=')>strpos(definition,'capture_document_commit_transition') then raise exception 'Access/receipt/CAS order changed.';end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.captures'::regclass and tgname='capture_document_row' and not tgisinternal)
  or not exists(select 1 from pg_trigger where tgrelid='public.captures'::regclass and tgname='capture_files_sync' and not tgisinternal)
  or not exists(select 1 from pg_trigger where tgrelid='public.captures'::regclass and tgname='knowledge_promoted_capture' and not tgisinternal) then raise exception 'Capture guards/file sync missing.';end if;
 select pg_get_functiondef('app_private.knowledge_promoted_capture()'::regprocedure) into definition;
 if strpos(definition,'document_version')=0 then raise exception 'Promoted document origin is mutable.';end if;
 if app_private.activity_projection_fields('capture') is distinct from array['title','content','type','status','category_id','project_id','converted_task_id','organized_at','archived_at','deleted_at','linked_capture_ids','attachments','document','document_version'] then raise exception 'Capture activity metadata mismatch.';end if;
end $$;
rollback;
