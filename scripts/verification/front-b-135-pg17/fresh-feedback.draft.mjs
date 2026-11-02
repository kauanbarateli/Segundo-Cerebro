// Synthetic PG17 only. Never execute outside the checked disposable runner.
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
const fail=()=>{throw Error('FRESH_FEEDBACK_REFUSED');};
const once=(text,search,replacement)=>{if(text.split(search).length!==2)fail();return text.replace(search,()=>replacement);};
export function freshFeedbackPlan(source,fixture){
 if(!Buffer.isBuffer(source)||hash(source)!=='25f765a5743512ad16aa3100e1959c9d74c7dee03726156da2af56e478c1ded2'||!Buffer.isBuffer(fixture)||hash(fixture)!=='a9c9e5b19ce7758c78c6bba1f152fd8dbef3ec0fa14d9cb9baaeb875316c48b5')fail();
 let sql=source.toString('utf8');
 sql=once(sql,"DO $scratch_guard$ BEGIN RAISE EXCEPTION 'UNREVIEWED SCRATCH SQL: DO NOT APPLY'; END $scratch_guard$;",'');
 sql=once(sql,"DO $event_contract_guard$ BEGIN RAISE EXCEPTION 'DOMAIN_EVENT_CONTRACT_NOT_QUALIFIED'; END $event_contract_guard$;",'');
 const rollback=once(sql,'\nCOMMIT;\n','\nROLLBACK;\n');
 const absent="select json_build_object('tablesAbsent',to_regclass('app_private.feedback_requests') is null and to_regclass('app_private.feedback_barriers_draft') is null,'functionAbsent',to_regprocedure('public.feedback_barrier_submit(uuid,uuid,uuid,text,text)') is null,'constraintSha',(select encode(sha256(convert_to(pg_get_constraintdef(oid),'UTF8')),'hex') from pg_constraint where conrelid='public.domain_events'::regclass and conname='domain_events_entity_type_check'));";
 const behavior=`BEGIN; SET LOCAL ROLE service_role;
 DO $test$ DECLARE first_result jsonb; replay jsonb; cancel_result jsonb; listing jsonb; BEGIN
  first_result:=public.feedback_barrier_submit('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','suggestion','Mensagem sintética de teste');
  replay:=public.feedback_barrier_submit('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','suggestion','Mensagem sintética de teste');
  IF first_result->>'status' IS DISTINCT FROM 'submitted' OR first_result->>'feedbackId' IS NULL OR replay->>'feedbackId' IS DISTINCT FROM first_result->>'feedbackId' THEN RAISE EXCEPTION 'REPLAY_REFUSED'; END IF;
  BEGIN PERFORM public.feedback_barrier_submit('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','other','Mensagem sintética de teste'); RAISE EXCEPTION 'CONFLICT_NOT_REJECTED'; EXCEPTION WHEN unique_violation THEN NULL; END;
  listing:=public.feedback_list('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002',NULL,NULL);
  IF jsonb_array_length(listing) IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'ISOLATION_REFUSED'; END IF;
  BEGIN PERFORM public.feedback_list('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002',NULL,NULL); RAISE EXCEPTION 'IDENTITY_NOT_REJECTED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  cancel_result:=public.feedback_barrier_cancel('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002');
  IF cancel_result->>'status' IS DISTINCT FROM 'cancelled' OR public.feedback_barrier_submit('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','suggestion','Mensagem sintética de teste')->>'status' IS DISTINCT FROM 'cancelled' THEN RAISE EXCEPTION 'CANCEL_REFUSED'; END IF;
 END $test$; COMMIT;`;
 const final="select json_build_object('feedbackRows',(select count(*) from app_private.feedback_requests),'eventRows',(select count(*) from public.domain_events where entity_type='feedback_request'),'barriers',(select count(*) from app_private.feedback_barriers_draft),'anonDenied',not has_function_privilege('anon','public.feedback_barrier_submit(uuid,uuid,uuid,text,text)','execute'),'authenticatedDenied',not has_function_privilege('authenticated','public.feedback_barrier_submit(uuid,uuid,uuid,text,text)','execute'));";
 return Object.freeze({seed:fixture.toString('utf8'),rollback,sql,absent,behavior,final});
}
export async function observeFreshFeedback(ports,source,fixture){
 let phase='plan';try{
  const p=freshFeedbackPlan(source,fixture);phase='seed';await ports.exec(p.seed);
  phase='baseline';const before=await ports.query(p.absent);if(!before.tablesAbsent||!before.functionAbsent||before.constraintSha!=='803504cb5f1c0ab40e7334eea9dc43e263ef54c04669c9ca7c0f76ba212280d3')fail();
  phase='rollback';await ports.exec(p.rollback);const after=await ports.query(p.absent);if(JSON.stringify(after)!==JSON.stringify(before))fail();
  phase='install';await ports.exec(p.sql);phase='behavior';await ports.exec(p.behavior);
  phase='final';const end=await ports.query(p.final);if(end.feedbackRows!==1||end.eventRows!==1||end.barriers!==2||end.anonDenied!==true||end.authenticatedDenied!==true)fail();
  return Object.freeze({scenario:'fresh-feedback-pg17',status:'CASE_OBSERVED_CLEANUP_PENDING',acceptance:false,hostedCertified:false});
 }catch(error){const reason=['COMMAND_FAILED','COMMAND_TIMEOUT','COMMAND_UNAVAILABLE','COMMAND_GROUP_UNCONFIRMED'].includes(error?.code)?error.code:'OTHER';process.stderr.write(JSON.stringify({code:'FRESH_FEEDBACK_REFUSED',phase,reason})+'\n');fail();}
}
