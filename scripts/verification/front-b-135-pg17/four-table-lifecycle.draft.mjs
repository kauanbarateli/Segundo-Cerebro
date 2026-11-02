// Synthetic isolated lifecycle only; not a hosted catalogue or MCP test.
import {createHash} from 'node:crypto';
import {observedLedgerCutoverPlan} from './observed-ledger-cutover.draft.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const fail=()=>{throw Error('FOUR_TABLE_LIFECYCLE_REFUSED');};
const once=(s,a,b)=>{if(s.split(a).length!==2)fail();return s.replace(a,()=>b);};
const strip=(s,a,b)=>{if(s.split(a).length!==2||s.split(b).length!==2)fail();const i=s.indexOf(a),j=s.indexOf(b,i);if(j<i)fail();return [s.slice(0,i),s.slice(i,j+b.length),s.slice(j+b.length)];};
export function fourTableLifecyclePlan(ctx,inputs){
 if(!Buffer.isBuffer(inputs.extension)||sha(inputs.extension)!=='eb9cc8f05bb36437689a9c84c6dbd5653845390fc9cabf3f8ad41bf91e636d0e'||!Buffer.isBuffer(inputs.restore)||sha(inputs.restore)!=='e4d4912e879bee6edbccfa6a554a6d89d230934051bc447ec000d74e780803a7')fail();
 const base=observedLedgerCutoverPlan(ctx,inputs);
 let extension=inputs.extension.toString('utf8'),restore=inputs.restore.toString('utf8');
 extension=once(extension,"DO $manual_guard$ BEGIN RAISE EXCEPTION 'STOP: four-table barrier is not qualified or authorized'; END $manual_guard$;",'');
 extension=once(extension,"DO $external_guard$ BEGIN RAISE EXCEPTION 'STOP: destination, consumers and safe recovery not proven'; END $external_guard$;",'');
 restore=once(restore,"DO $manual_guard$ BEGIN RAISE EXCEPTION 'STOP: four-table recovery not qualified or authorized'; END $manual_guard$;",'');
 restore=once(restore,"DO $external_guard$ BEGIN RAISE EXCEPTION 'STOP: writers and safe recovery not proven'; END $external_guard$;",'');
 const synthetic="DO $synthetic_catalog$ BEGIN IF current_user<>'postgres' OR current_setting('server_version_num')<>'170011' OR NOT EXISTS(SELECT 1 FROM app_private.signup_settings WHERE singleton AND NOT enabled) THEN RAISE EXCEPTION 'SYNTHETIC_CATALOG_REFUSED'; END IF; END $synthetic_catalog$;";
 let [left,catalog,right]=strip(extension,'DO $catalog_guard$','END $catalog_guard$;');
 const boundary=' PERFORM 1 FROM app_private.signup_settings';if(catalog.split(boundary).length!==2)fail();
 const realLedger=catalog.slice(0,catalog.indexOf(boundary))+'END $catalog_guard$;';
 extension=left+realLedger+'\n'+synthetic+right;
 [left,catalog,right]=strip(restore,'DO $catalog_guard$','END $catalog_guard$;');restore=left+synthetic+right;
 const extensionRollback=once(extension,'\nCOMMIT;\n','\nROLLBACK;\n');
 const extensionHash=sha(Buffer.from(extension)),version='20261102100909',name='sc218_four_ext_synthetic';
 restore=once(restore,"actual_extension_version constant text := '__QA_FOUR_FREEZE_VERSION_PENDING__';",`actual_extension_version constant text := '${version}';`);
 restore=once(restore,"actual_extension_name constant text := '__QA_FOUR_FREEZE_NAME_PENDING__';",`actual_extension_name constant text := '${name}';`);
 restore=once(restore,"actual_extension_hash constant text := '__QA_FOUR_FREEZE_HASH_PENDING__';",`actual_extension_hash constant text := '${extensionHash}';`);
 if(extension.includes('$sc_four_extension$'))fail();
 const seedLedger=`INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('${version}','${name}',ARRAY[$sc_four_extension$${extension}$sc_four_extension$]);`;
 const tables=[['signup_completion_fences_draft','updated_at'],['signup_intents','state'],['signup_origins','origin'],['user_admission','state']];
 const expectFrozen=tables.map(([table,column])=>`BEGIN BEGIN EXECUTE 'UPDATE app_private.${table} SET ${column}=${column} WHERE false'; RAISE EXCEPTION 'UNEXPECTED_WRITE'; EXCEPTION WHEN OTHERS THEN IF SQLSTATE<>'55000' OR SQLERRM<>'QA_CUTOVER_PERSISTENT_WRITE_FREEZE' THEN RAISE; END IF; END; END;`).join('\n');
 const frozen=`DO $frozen_test$ BEGIN ${expectFrozen} END $frozen_test$;`;
 const state="select json_build_object('count',(select count(*) from pg_trigger where tgname='sc_cutover_freeze_038f' and tgenabled='A' and not tgisinternal and tgrelid in ('app_private.signup_completion_fences_draft'::regclass,'app_private.signup_intents'::regclass,'app_private.signup_origins'::regclass,'app_private.user_admission'::regclass)),'function',to_regprocedure('app_private.sc_cutover_freeze_038f()') is not null,'empty',not exists(select 1 from app_private.signup_intents) and not exists(select 1 from app_private.signup_origins) and not exists(select 1 from app_private.signup_completion_fences_draft));";
 return Object.freeze({seed:base.seed,quarantine:base.quarantine,bindLedger:base.seedStatement,extensionRollback,extension,seedLedger,restore,frozen,state});
}
export async function observeFourTableLifecycle(ports,ctx,inputs){
 if(!ports||typeof ports.exec!=='function'||typeof ports.query!=='function')fail();let phase='plan';
 const state=async(p,count)=>{const r=await ports.query(p.state);if(!r||r.count!==count||r.function!==true||r.empty!==true)fail();};
 try{const p=fourTableLifecyclePlan(ctx,inputs);phase='seed';await ports.exec(p.seed);await ports.exec(p.quarantine);await ports.exec(p.bindLedger);await state(p,2);
  phase='extension-rollback';await ports.exec(p.extensionRollback);await state(p,2);
  phase='extension-commit';await ports.exec(p.extension);await state(p,4);
  phase='zero-row-block';await ports.exec(p.frozen);
  phase='bind-extension';await ports.exec(p.seedLedger);
  phase='recovery';await ports.exec(p.restore);await state(p,2);
  return Object.freeze({scenario:'four-table-lifecycle-pg17',status:'CASE_OBSERVED_CLEANUP_PENDING',acceptance:false,hostedCertified:false});
 }catch(error){const reason=['COMMAND_FAILED','COMMAND_TIMEOUT','COMMAND_UNAVAILABLE','COMMAND_GROUP_UNCONFIRMED'].includes(error?.code)?error.code:'OTHER';process.stderr.write(JSON.stringify({code:'FOUR_TABLE_LIFECYCLE_REFUSED',phase,reason})+'\n');fail();}
}
