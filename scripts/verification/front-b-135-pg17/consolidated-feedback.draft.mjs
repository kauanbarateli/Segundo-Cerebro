// Synthetic PG17 fixture only. Never execute on a hosted database.
import {createHash} from 'node:crypto';
import {freshFeedbackPlan} from './fresh-feedback.draft.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const refuse=()=>{throw Error('CONSOLIDATED_FEEDBACK_REFUSED');};
const once=(text,needle,replacement)=>{if(text.split(needle).length!==2)refuse();return text.replace(needle,()=>replacement);};
const expected={
 require_actor:'68e8122cedd4c6062b4c9ee9630fcdbba36a5e079ce31c9ded480ca23fa2f478',
 session_active:'d996b99e2bc3f327a1780582cdfd44cdce482c572eb765b1fb0004eff7a5092d',
 append_event:'f59ebde8976e8b6d0f68dcc9676336f29c648de86cb3d47f92c26d9fdcd19c85',
};
export function syntheticPlan(source,fixtureHashes){
 if(!Buffer.isBuffer(source)||hash(source)!=='d6c3ad7958e1c9dcbeeedaf741ba86794fde4e03e4c97424fa728f6b9fae4bbf')refuse();
 let sql=source.toString('utf8');if(!Buffer.from(sql).equals(source))refuse();
 for(const guard of ["DO $scratch_guard$ BEGIN RAISE EXCEPTION 'UNREVIEWED SCRATCH SQL: DO NOT APPLY'; END $scratch_guard$;", "DO $manual_guard$ BEGIN RAISE EXCEPTION 'STOP: feedback release not qualified or authorized'; END $manual_guard$;", "DO $pt409_guard$ BEGIN RAISE EXCEPTION 'STOP: PT409 preservation not yet qualified'; END $pt409_guard$;", "DO $event_contract_guard$ BEGIN RAISE EXCEPTION 'DOMAIN_EVENT_CONTRACT_NOT_QUALIFIED'; END $event_contract_guard$;"])sql=once(sql,guard,'');
 for(const [name,pin] of Object.entries(expected)){
  const replacement=fixtureHashes?.[name];if(typeof replacement!=='string'||!/^[0-9a-f]{64}$/.test(replacement))refuse();
  sql=once(sql,pin,replacement);
 }
 return Object.freeze({sql,rollback:once(sql,'\nCOMMIT;\n','\nROLLBACK;\n')});
}
export async function observeConsolidatedFeedback(ports,source,fixture,addon,original){
 let phase='fixture';try{
  if(!Buffer.isBuffer(fixture)||hash(fixture)!=='a9c9e5b19ce7758c78c6bba1f152fd8dbef3ec0fa14d9cb9baaeb875316c48b5'||!Buffer.isBuffer(addon)||hash(addon)!=='b806f043d75b815234e087780cac45ae90c45e8c8b57c8d5ca3a867f207b7d2b')refuse();
  const behavior=freshFeedbackPlan(original,fixture);await ports.exec(fixture.toString('utf8'));await ports.exec(addon.toString('utf8'));
  phase='fixture-hashes';const hashes=await ports.query("select json_object_agg(p.proname,encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and p.proname in ('require_actor','session_active','append_event');");
  const plan=syntheticPlan(source,hashes);phase='baseline';const before=await ports.query(behavior.absent);
  if(!before.tablesAbsent||!before.functionAbsent||before.constraintSha!=='803504cb5f1c0ab40e7334eea9dc43e263ef54c04669c9ca7c0f76ba212280d3')refuse();
  phase='rollback';await ports.exec(plan.rollback);const after=await ports.query(behavior.absent);if(JSON.stringify(before)!==JSON.stringify(after))refuse();
  phase='install';await ports.exec(plan.sql);phase='behavior';await ports.exec(behavior.behavior);
  phase='final';const end=await ports.query(behavior.final);if(end.feedbackRows!==1||end.eventRows!==1||end.barriers!==2||end.anonDenied!==true||end.authenticatedDenied!==true)refuse();
  return Object.freeze({scenario:'consolidated-feedback-pg17',status:'CASE_OBSERVED_CLEANUP_PENDING',acceptance:false,hostedCertified:false});
 }catch(error){const reason=['COMMAND_FAILED','COMMAND_TIMEOUT','COMMAND_UNAVAILABLE','COMMAND_GROUP_UNCONFIRMED'].includes(error?.code)?error.code:'OTHER';process.stderr.write(JSON.stringify({code:'CONSOLIDATED_FEEDBACK_REFUSED',phase,reason})+'\n');refuse();}
}
