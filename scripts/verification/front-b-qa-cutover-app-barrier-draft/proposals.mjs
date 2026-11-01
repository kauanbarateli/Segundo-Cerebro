// Inert local alternative for review. No database connection or writer control.
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {quarantineProposal,cutoverProposal,COMPOSITION_SHA} from '../front-b-qa-cutover-038f/proposals.mjs';
const BASE_SHA='7de566f5df8e52955f0a42b27b3d7056417f5ff29c933f95d24b97e913bd700c';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const originalLock='lock table cron.job,auth.users,app_private.signup_settings,app_private.user_admission,app_private.signup_intents,app_private.signup_completion_fences_draft in share row exclusive mode;';
const appLock='lock table auth.users,app_private.signup_settings,app_private.user_admission,app_private.signup_intents,app_private.signup_origins,app_private.signup_completion_fences_draft in share row exclusive mode;';
const originalCheck='  or exists(select 1 from app_private.signup_completion_fences_draft)';
const barrierGuard="do $app_barrier_guard$ begin raise exception 'APPLICATION_BARRIER_AND_DRAIN_NOT_PROVEN'; end $app_barrier_guard$;";
function replaceOnce(text,oldValue,newValue){if(text.split(oldValue).length!==2)throw Error('EXACT_TRANSFORM_REFUSED');return text.replace(oldValue,newValue);}
export async function makeProposals(composition){
 const base=await readFile(new URL('../front-b-qa-cutover-038f/proposals.mjs',import.meta.url));
 if(hash(base)!==BASE_SHA || !Buffer.isBuffer(composition) || hash(composition)!==COMPOSITION_SHA)throw Error('SOURCE_REFUSED');
 const transform=(sql,guard)=>{
  sql=replaceOnce(sql,guard,guard+'\n'+barrierGuard);
  sql=replaceOnce(sql,originalLock,appLock);
  sql=replaceOnce(sql,originalCheck,originalCheck+'\n  or exists(select 1 from app_private.signup_origins)');
  return sql;
 };
 const quarantine=transform(quarantineProposal(),"do $quarantine_guard$ begin raise exception 'REVIEW_AND_QA_AUTHORIZATION_REQUIRED'; end $quarantine_guard$;");
 const cutover=transform(cutoverProposal(composition),"do $cutover_guard$ begin raise exception 'REVIEW_AND_QA_AUTHORIZATION_REQUIRED'; end $cutover_guard$;");
 return Object.freeze({quarantine,cutover});
}
