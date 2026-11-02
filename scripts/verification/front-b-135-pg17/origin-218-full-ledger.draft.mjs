// Synthetic offline experiment. It does not reproduce the hosted catalog or MCP.
import { createHash } from 'node:crypto';
import { origin218FreezePlan } from './origin-218-freeze-exception.draft.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=()=>{throw Error('ORIGIN_218_LEDGER_REFUSED');};
const pin={quarantine:'3079f81cb88ca090286e8b664c5102361e3986c6639309514094277bfe21a58d',cutover:'e1d1bf04bb9723a7fa907b5c6a8d24154e87be93f9b993edcf36b8f0acff01aa'};
const once=(s,a,b)=>{if(s.split(a).length!==2)fail();return s.replace(a,b);};
const qVersion='20261102000001',cVersion='20261102000002';
const qHard="DO $manual_guard$ BEGIN RAISE EXCEPTION 'STOP: quarantine is not qualified or authorized'; END $manual_guard$;";
const qExt="DO $external_guard$ BEGIN RAISE EXCEPTION 'STOP: destination, writers and Auth not proven'; END $external_guard$;";
const cHard="DO $manual_guard$ BEGIN RAISE EXCEPTION 'STOP: migration is not qualified or authorized'; END $manual_guard$;";
const cDrain="DO $cutover_guard$ BEGIN RAISE EXCEPTION 'STOP: writer quarantine and drainage are not qualified'; END $cutover_guard$;";
function ledger(sql,version,commit){return once(sql,'\nCOMMIT;',`\nINSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('${version}','synthetic_only',ARRAY['synthetic']);\n${commit?'COMMIT;':'ROLLBACK;'}`);}
export function origin218LedgerPlan(ctx,inputs){
 for(const k of ['quarantine','cutover'])if(!Buffer.isBuffer(inputs[k])||sha(inputs[k])!==pin[k])fail();
 const freezePlan=origin218FreezePlan(ctx,inputs.freeze,inputs.candidate,'commit',inputs.foundation);
 const setup=freezePlan.setup,from=setup.indexOf('do $fixture_guard$'),to=setup.indexOf('-- Persist beyond the transaction;');if(from<0||to<from)fail();const legacy=setup.slice(from,to);
 const originals=inputs.cutover.toString('utf8'),begin='DO $catalog_guard$',end='END $catalog_guard$;';
 if(originals.split(begin).length!==2||originals.split(end).length!==2)fail();
 const first=originals.indexOf(begin),last=originals.indexOf(end)+end.length,realGuard=originals.slice(first,last);
 const syntheticGuard=`DO $synthetic_catalog_guard$ BEGIN IF current_user<>'postgres' OR current_setting('server_version_num')<>'170011' OR NOT EXISTS(SELECT 1 FROM app_private.signup_settings WHERE singleton AND NOT enabled) OR (SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version='${qVersion}' AND name='synthetic_only')<>1 OR EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version>'20261101235120' AND version<>'${qVersion}') THEN RAISE EXCEPTION 'SYNTHETIC_CATALOG_REFUSED'; END IF; END $synthetic_catalog_guard$;`;
 let cut=once(once(originals,cHard,''),cDrain,'');cut=once(cut,realGuard,syntheticGuard);
 let quarantine=once(once(inputs.quarantine.toString('utf8'),qHard,''),qExt,'');
 const seed=`begin;${legacy}create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[]);insert into supabase_migrations.schema_migrations values ('20261101172256','m028_front_b_signup_feedback_metrics_qa',array['synthetic']),('20261101234319','m029_front_b_signup_quarantine_038f_qa',array['synthetic']),('20261101234954','m029_front_b_signup_browser_cutover_038f_qa',array['synthetic']),('20261101235120','m029_front_b_signup_thaw_038f_qa',array['synthetic']);update app_private.signup_settings set enabled=false where singleton;commit;`;
 const check=`select json_build_object('kind','state','quarantine',exists(select 1 from supabase_migrations.schema_migrations where version='${qVersion}'),'cutover',exists(select 1 from supabase_migrations.schema_migrations where version='${cVersion}'),'freeze',to_regprocedure('app_private.sc_cutover_freeze_038f()') is not null,'triggers',(select count(*)=2 from pg_trigger where tgname='sc_cutover_freeze_038f' and tgenabled='A' and not tgisinternal and tgrelid in ('app_private.signup_intents'::regclass,'app_private.signup_origins'::regclass)),'v2',to_regprocedure('public.signup_origin_withdraw_v2(uuid,uuid,uuid)') is not null);`;
 // The original catalog block runs unmodified and must reject the added ledger row.
 const negative=`DO $negative$ BEGIN BEGIN EXECUTE $original_guard$${realGuard}$original_guard$; RAISE EXCEPTION 'ORIGINAL_GUARD_UNEXPECTED_SUCCESS'; EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'STOP: ledger differs from reviewed QA snapshot' THEN RAISE; END IF; END; END $negative$;`;
 return Object.freeze({seed,negative,quarantineRollback:ledger(quarantine,qVersion,false),quarantineCommit:ledger(quarantine,qVersion,true),cutoverRollback:ledger(cut,cVersion,false),cutoverCommit:ledger(cut,cVersion,true),check});
}
export async function observeOrigin218Ledger(ports,ctx,inputs,kind){
 if(!ports||typeof ports.exec!=='function'||typeof ports.query!=='function'||!['quarantine','cutover'].includes(kind))fail();const p=origin218LedgerPlan(ctx,inputs);let phase='seed';
 const state=async(q,c,freeze,v2)=>{const x=await ports.query(p.check);if(!x||Object.keys(x).sort().join(',')!=='cutover,freeze,kind,quarantine,triggers,v2'||x.kind!=='state'||x.quarantine!==q||x.cutover!==c||x.freeze!==freeze||x.triggers!==freeze||x.v2!==v2)fail();};
 try{await ports.exec(p.seed);if(kind==='quarantine'){phase='quarantine-rollback';await ports.exec(p.quarantineRollback);await state(false,false,false,false);phase='quarantine-commit';await ports.exec(p.quarantineCommit);await state(true,false,true,false);}else{phase='quarantine';await ports.exec(p.quarantineCommit);await state(true,false,true,false);phase='real-guard-refusal';await ports.exec(p.negative);phase='cutover-rollback';await ports.exec(p.cutoverRollback);await state(true,false,true,false);phase='cutover-commit';await ports.exec(p.cutoverCommit);await state(true,true,true,true);}}catch{process.stderr.write(JSON.stringify({code:'ORIGIN_218_LEDGER_REFUSED',kind,phase})+'\n');fail();}
 return Object.freeze({scenario:`origin-218-full-${kind}-synthetic-ledger-pg17`,status:'CASE_OBSERVED_CLEANUP_PENDING',acceptance:false,hostedCertified:false});
}
