// Offline synthetic catalogue only; does not certify QA or MCP.
import {createHash} from 'node:crypto';
import {origin218LedgerPlan} from './origin-218-full-ledger.draft.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=()=>{throw Error('OBSERVED_LEDGER_CUTOVER_REFUSED');};
const once=(s,a,b)=>{if(s.split(a).length!==2)fail();return s.replace(a,()=>b);};
const oldVersion='20261102000001',version='20261102100908',name='sc218_quarantine_install_20261102';
export function observedLedgerCutoverPlan(ctx,inputs){
 if(!Buffer.isBuffer(inputs.observed)||sha(inputs.observed)!=='3d00f3b2f81edfff0dcd01b3837a11925ebdcb3ed542ebe8158e2a28e8d0a17c'||!Buffer.isBuffer(inputs.install)||sha(inputs.install)!=='fab48cfdf12630643623e4e1d58251b3bcc35bc7c6c0f57d7d93e415514ddb00')fail();
 const base=origin218LedgerPlan(ctx,inputs),install=inputs.install.toString('utf8');
 if(!Buffer.from(install).equals(inputs.install)||install.includes('$sc_install$'))fail();
 let raw=inputs.observed.toString('utf8');
 raw=once(raw,"DO $manual_guard$ BEGIN RAISE EXCEPTION 'STOP: migration is not qualified or authorized'; END $manual_guard$;",'');
 raw=once(raw,"DO $cutover_guard$ BEGIN RAISE EXCEPTION 'STOP: writer quarantine and drainage are not qualified'; END $cutover_guard$;",'');
 const start='DO $catalog_guard$',ledgerEnd=' PERFORM 1 FROM app_private.signup_settings',end='END $catalog_guard$;';
 if(raw.split(start).length!==2||raw.split(ledgerEnd).length!==2||raw.split(end).length!==2)fail();
 const first=raw.indexOf(start),last=raw.indexOf(end)+end.length,ledgerGuard=raw.slice(first,raw.indexOf(ledgerEnd))+'END $catalog_guard$;';
 if(ledgerGuard.includes('$sc_ledger_guard$'))fail();
 // Only the 38-function/four-table catalogue checks are fixture-specific;
 // retain the exact candidate's ledger guard unmodified.
 const synthetic=`DO $synthetic_catalog$ BEGIN IF NOT EXISTS(SELECT 1 FROM app_private.signup_settings WHERE singleton AND NOT enabled) THEN RAISE EXCEPTION 'SYNTHETIC_CATALOG_REFUSED'; END IF; END $synthetic_catalog$;`;
 const cutover=raw.slice(0,first)+ledgerGuard+'\n'+synthetic+raw.slice(last);
 const seedStatement=`UPDATE supabase_migrations.schema_migrations SET version='${version}',name='${name}',statements=ARRAY[$sc_install$${install}$sc_install$] WHERE version='${oldVersion}' AND name='synthetic_only';`;
 const bad=`UPDATE supabase_migrations.schema_migrations SET statements=ARRAY['bad_synthetic'] WHERE version='${version}' AND name='${name}';`;
 const restore=`UPDATE supabase_migrations.schema_migrations SET statements=ARRAY[$sc_install$${install}$sc_install$] WHERE version='${version}' AND name='${name}';`;
 const extra="INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20261102100909','synthetic_unexpected',ARRAY['synthetic']);";
 const removeExtra="DELETE FROM supabase_migrations.schema_migrations WHERE version='20261102100909' AND name='synthetic_unexpected';";
 const reject=`DO $test_refusal$ BEGIN BEGIN EXECUTE $sc_ledger_guard$${ledgerGuard}$sc_ledger_guard$; RAISE EXCEPTION 'UNEXPECTED_LEDGER_ACCEPTANCE'; EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'STOP: ledger differs from reviewed QA snapshot' THEN RAISE; END IF; END; END $test_refusal$;`;
 const state=`select json_build_object('ledger',exists(select 1 from supabase_migrations.schema_migrations where version='${version}' and name='${name}'),'freeze',to_regprocedure('app_private.sc_cutover_freeze_038f()') is not null,'triggers',(select count(*)=2 from pg_trigger where tgname='sc_cutover_freeze_038f' and tgenabled='A' and not tgisinternal and tgrelid in ('app_private.signup_intents'::regclass,'app_private.signup_origins'::regclass)),'v2',to_regprocedure('public.signup_origin_withdraw_v2(uuid,uuid,uuid)') is not null);`;
 return Object.freeze({seed:base.seed,quarantine:base.quarantineCommit,seedStatement,bad,restore,extra,removeExtra,reject,cutover,state});
}
export async function observeObservedLedgerCutover(ports,ctx,inputs){
 if(!ports||typeof ports.exec!=='function'||typeof ports.query!=='function')fail();let phase='plan';
 try{
  const p=observedLedgerCutoverPlan(ctx,inputs);phase='seed';await ports.exec(p.seed);phase='quarantine';await ports.exec(p.quarantine);phase='bind-ledger';await ports.exec(p.seedStatement);
  phase='bad-hash';await ports.exec(p.bad);await ports.exec(p.reject);await ports.exec(p.restore);
  phase='extra-ledger';await ports.exec(p.extra);await ports.exec(p.reject);await ports.exec(p.removeExtra);
  phase='before';const before=await ports.query(p.state);if(!before||before.ledger!==true||before.freeze!==true||before.triggers!==true||before.v2!==false)fail();
  phase='cutover';await ports.exec(p.cutover);
  phase='after';const after=await ports.query(p.state);if(!after||after.ledger!==true||after.freeze!==true||after.triggers!==true||after.v2!==true)fail();
  return Object.freeze({scenario:'observed-ledger-cutover-pg17',status:'CASE_OBSERVED_CLEANUP_PENDING',acceptance:false,hostedCertified:false});
 }catch(error){const reason=['COMMAND_FAILED','COMMAND_TIMEOUT','COMMAND_UNAVAILABLE','COMMAND_GROUP_UNCONFIRMED'].includes(error?.code)?error.code:'OTHER';process.stderr.write(JSON.stringify({code:'OBSERVED_LEDGER_CUTOVER_REFUSED',phase,reason})+'\n');fail();}
}
