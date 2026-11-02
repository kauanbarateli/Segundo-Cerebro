// Offline synthetic fixture only: does not prove hosted catalogue or MCP.
import {createHash} from 'node:crypto';
import {origin218LedgerPlan} from './origin-218-full-ledger.draft.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=()=>{throw Error('RECOVERY_LEDGER_BOUND_REFUSED');};
const once=(s,a,b)=>{if(s.split(a).length!==2)fail();return s.replace(a,()=>b);};
const version='20261102000001',name='synthetic_only';

export function recoveryLedgerPlan(ctx,inputs){
 if(!Buffer.isBuffer(inputs.recovery)||sha(inputs.recovery)!=='7b51eb4ea9b12deed1a969efdfc9368bd494ce2247af495f004c2cf6a92ac84c'||!Buffer.isBuffer(inputs.install)||sha(inputs.install)!=='fab48cfdf12630643623e4e1d58251b3bcc35bc7c6c0f57d7d93e415514ddb00')fail();
 const base=origin218LedgerPlan(ctx,inputs),raw=inputs.install.toString('utf8');
 if(!Buffer.from(raw).equals(inputs.install)||raw.includes('$sc_install_statement$'))fail();
 let recovery=inputs.recovery.toString('utf8');
 recovery=once(recovery,"DO $manual_guard$ BEGIN RAISE EXCEPTION 'STOP: cancellation not qualified or authorized'; END $manual_guard$;\n",'');
 recovery=once(recovery,"DO $external_guard$ BEGIN RAISE EXCEPTION 'STOP: writers and safe recovery not proven'; END $external_guard$;\n",'');
 recovery=once(recovery,'__QA_QUARANTINE_VERSION_PENDING__',version);
 // The name placeholder occurs in its declaration and in the fail-closed check.
 const marker='__QA_QUARANTINE_NAME_PENDING__';if(recovery.split(marker).length!==3)fail();
 recovery=recovery.replace(marker,()=>name);
 const seedStatement=`UPDATE supabase_migrations.schema_migrations SET statements=ARRAY[$sc_install_statement$${raw}$sc_install_statement$] WHERE version='${version}' AND name='${name}';`;
 return Object.freeze({seed:base.seed,quarantine:base.quarantineCommit,seedStatement,recovery,check:base.check});
}
export async function observeRecoveryLedger(ports,ctx,inputs){
 if(!ports||typeof ports.exec!=='function'||typeof ports.query!=='function')fail();
 let phase='plan';
 try{
  const p=recoveryLedgerPlan(ctx,inputs);
  phase='seed';await ports.exec(p.seed);
  phase='quarantine';await ports.exec(p.quarantine);
  phase='seed-statement';await ports.exec(p.seedStatement);
  phase='before';const before=await ports.query(p.check);if(!before||before.quarantine!==true||before.cutover!==false||before.freeze!==true||before.triggers!==true||before.v2!==false)fail();
  phase='recovery';await ports.exec(p.recovery);
  phase='after';const after=await ports.query(p.check);if(!after||after.quarantine!==true||after.cutover!==false||after.freeze!==false||after.triggers!==false||after.v2!==false)fail();
  return Object.freeze({scenario:'recovery-ledger-bound-pg17',status:'CASE_OBSERVED_CLEANUP_PENDING',acceptance:false,hostedCertified:false});
 }catch(error){
  const reason=['COMMAND_FAILED','COMMAND_TIMEOUT','COMMAND_UNAVAILABLE','COMMAND_GROUP_UNCONFIRMED'].includes(error?.code)?error.code:'OTHER';
  process.stderr.write(JSON.stringify({code:'RECOVERY_LEDGER_BOUND_REFUSED',phase,reason})+'\n');
  fail();
 }
}
