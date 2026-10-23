/** Proposed negative gates. Disposable PostgreSQL only; no remote connection,
 * Auth service, object bytes, Cron, native process, or migration promotion. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {registerHooks} from 'node:module';
const candidateHelperUrl=new URL('../../tests/helpers/onboarding-candidate-sql.ts',import.meta.url);
const canonicalHelperUrl=new URL('../../tests/helpers/local-canonical-sql.ts',import.meta.url);
function resolveCandidateLocalImport(specifier,context,nextResolve){
 if(specifier==='./local-canonical-sql'&&context.parentURL===candidateHelperUrl.href)return nextResolve(canonicalHelperUrl.href,context);
 return nextResolve(specifier,context);
}
// Only this reviewed helper's extensionless local import needs the Node bridge.
// Bare packages and every other parent/specifier use normal Node resolution.
const candidateHook=registerHooks({resolve:resolveCandidateLocalImport});
let createOnboardingCandidateSql,prepareOnboardingCandidateSql;
try{({createOnboardingCandidateSql,prepareOnboardingCandidateSql}=await import(candidateHelperUrl.href));}
finally{candidateHook.deregister();}

test('026 candidate Node resolver is limited to the exact reviewed parent and local specifier',()=>{
 const observations=[],next=(specifier,context)=>{observations.push({specifier,context});return{url:specifier};};
 const expected={parentURL:candidateHelperUrl.href};assert.deepEqual(resolveCandidateLocalImport('./local-canonical-sql',expected,next),{url:canonicalHelperUrl.href});
 for(const[specifier,parentURL]of[['./local-canonical-sql',new URL('./lookalike.ts',candidateHelperUrl).href],['./local-canonical-sql.ts',candidateHelperUrl.href],['./local-canonical-sql-copy',candidateHelperUrl.href],['@electric-sql/pglite',candidateHelperUrl.href],['node:fs',candidateHelperUrl.href]]){
  const context={parentURL};assert.deepEqual(resolveCandidateLocalImport(specifier,context,next),{url:specifier});assert.equal(observations.at(-1).specifier,specifier);assert.equal(observations.at(-1).context,context);
 }
});

test('026 catalogue preserves historical checks and refuses new authority, shape, body and trigger drift',async()=>{
 const prepared=await prepareOnboardingCandidateSql();
 assert.equal(prepared.sha256,'e62727f4aa3a2f56948bf3a3c2f4ec24b1a8278ac3bef07591424b1ba422e697');
 const metadata=JSON.parse(await readFile(new URL('../fixtures/onboarding-026-release-catalog.json',import.meta.url),'utf8'));
 assert.equal(metadata.functions.length,29);assert.equal(metadata.tables.length,9);
 assert.equal(metadata.pg17Compatibility.notNullConstraintRowsExcluded,62);
 assert.equal(metadata.tables.flatMap(table=>table.constraints).some(item=>item.definition.startsWith('NOT NULL ')),false);
 const source=await readFile(new URL('../../supabase/tests/release-catalog.sql',import.meta.url),'utf8');
 assert.match(source,/^-- T028/);assert.match(source,/begin transaction read only;/);assert.match(source,/rollback;\s*$/);
 const db=await createOnboardingCandidateSql();
 try{
  const engine=(await db.query("select current_setting('server_version_num')::integer version")).rows[0].version;
  const report=async()=>{
   const values=(await db.exec(source)).flatMap(value=>value.rows).map(row=>row.jsonb_build_object).filter(value=>value?.version===1);
   assert.equal(values.length,1);return values[0];
  };
  const baseline=await report();assert.equal(baseline.ok,true);assert.deepEqual(baseline.deviations,[]);
  // Record the actual result. Do not forecast a native consumer's strict total.
  assert.equal(Number.isSafeInteger(baseline.checks),true);assert.ok(baseline.checks>metadata.oldCatalogueReport.checks);
  const reviewed=async()=>{const value=await report();assert.equal(value.checks,baseline.checks);assert.equal(value.ok,true);assert.deepEqual(value.deviations,[]);};
  const rejected=async(check,object)=>{const value=await report();assert.equal(value.checks,baseline.checks);assert.equal(value.ok,false);assert.ok(value.deviations.some(row=>row.check===check&&row.object===object),check+' '+object);};
  const change=async(mutation,restore,check,object)=>{try{await db.exec(mutation);await rejected(check,object);}finally{await db.exec(restore);}await reviewed();};
  const definitionOf=async signature=>(await db.query('select pg_get_functiondef($1::regprocedure) definition',[signature])).rows[0].definition;
  const historical=[
   ['app_private.projects_habits_commit(uuid,uuid,text,jsonb)','perform app_private.onboarding_reserved_guard(p_user,p_session,p_operation,p_request);','onboarding_function'],
   ['app_private.capture_task_commit(uuid,uuid,text,jsonb)','perform app_private.onboarding_reserved_guard(p_user,p_session,p_operation,p_request);','onboarding_function'],
   ['app_private.knowledge_commit(uuid,uuid,text,jsonb)','perform app_private.onboarding_reserved_guard(p_user,p_session,p_operation,p_request);','spec_evolution_function'],
   ['public.settings_commit(uuid,uuid,jsonb)','perform app_private.onboarding_settings_reserved_guard(p_request);','spec_evolution_function'],
   ['app_private.google_calendar_call(uuid,uuid,text,jsonb,boolean,uuid)','perform app_private.onboarding_oauth_reserved_guard(p_user,p_session,p_command,p_input);','spec_evolution_function'],
  ];
  for(const[signature,guard,check]of historical){
   const definition=await definitionOf(signature),altered=definition.replace(guard,'null;');assert.notEqual(altered,definition);
   await change(altered,definition,check,signature);
  }
  const privateSignature='app_private.onboarding_require(uuid,uuid,text)',privateDefinition=await definitionOf(privateSignature);
  const weaker=privateDefinition.replace('perform app_private.require_actor(p_user,p_session);','null;');assert.notEqual(weaker,privateDefinition);
  await change(weaker,privateDefinition,'onboarding_function',privateSignature);
  const widerDefault=privateDefinition.replace(/\bDEFAULT 'configuracoes'::text\b/,'DEFAULT \'projetos\'::text');assert.notEqual(widerDefault,privateDefinition);
  await change(widerDefault,privateDefinition,'onboarding_function',privateSignature);
  for(const alteration of['security invoker','set work_mem=\'8MB\'','stable'])await change('alter function '+privateSignature+' '+alteration,privateDefinition,'onboarding_function',privateSignature);
  await change('grant execute on function '+privateSignature+' to service_role','revoke execute on function '+privateSignature+' from service_role','onboarding_function',privateSignature);
  await change('create role onboarding_catalog_extra nologin;grant execute on function '+privateSignature+' to onboarding_catalog_extra','revoke execute on function '+privateSignature+' from onboarding_catalog_extra;drop role onboarding_catalog_extra','onboarding_function',privateSignature);
  const publicSignature='public.onboarding_call(uuid,uuid,text,jsonb)';
  await change('grant execute on function '+publicSignature+' to authenticated','revoke execute on function '+publicSignature+' from authenticated','onboarding_function',publicSignature);
  await change('grant select on app_private.onboarding_rounds to service_role','revoke select on app_private.onboarding_rounds from service_role','service_table_closed','app_private.onboarding_rounds');
  await change('alter table app_private.onboarding_rounds disable row level security','alter table app_private.onboarding_rounds enable row level security','onboarding_relation','app_private.onboarding_rounds');
  await change('alter table app_private.onboarding_rounds alter column created_at set default now()','alter table app_private.onboarding_rounds alter column created_at set default clock_timestamp()','onboarding_relation','app_private.onboarding_rounds');
  await change('alter table app_private.profile_focus alter column revision drop not null','alter table app_private.profile_focus alter column revision set not null','onboarding_relation','app_private.profile_focus');
  const index=(await db.query("select pg_get_indexdef('app_private.onboarding_one_open'::regclass) definition")).rows[0].definition;
  await change('drop index app_private.onboarding_one_open',index,'onboarding_relation','app_private.onboarding_rounds');
  await change('alter table app_private.onboarding_write_permits disable trigger onboarding_permit_zero','alter table app_private.onboarding_write_permits enable trigger onboarding_permit_zero','onboarding_relation','app_private.onboarding_write_permits');
  await change('alter table app_private.admin_operations disable trigger onboarding_verified_admin_completion','alter table app_private.admin_operations enable trigger onboarding_verified_admin_completion','onboarding_admin_enrollment_trigger','app_private.admin_operations.onboarding_verified_admin_completion');
  // The unchanged SPEC08 controls must still be independently authoritative.
  const oldSignature='app_private.calendar_attendee_pair_valid(jsonb)',oldDefinition=await definitionOf(oldSignature),oldWeakened=oldDefinition.replace('jsonb_array_length(p->\'attendees\')>200','jsonb_array_length(p->\'attendees\')>201');assert.notEqual(oldWeakened,oldDefinition);
  await change(oldWeakened,oldDefinition,'spec_evolution_function',oldSignature);
  try{await db.exec(privateDefinition.replaceAll('\r\n','\n').replaceAll('\n','\r\n'));await reviewed();}finally{await db.exec(privateDefinition);}
  await reviewed();
  const residue=(await db.query('select (select count(*)::integer from auth.users) users,(select count(*)::integer from public.domain_events) events,(select count(*)::integer from app_private.command_receipts) receipts,(select count(*)::integer from app_private.onboarding_rounds) rounds')).rows;
  assert.deepEqual(residue,[{users:0,events:0,receipts:0,rounds:0}]);
  console.log(JSON.stringify({operation:'PUBLIC_026_CATALOGUE_NEGATIVE_GATES',ok:true,checks:baseline.checks,candidateSha256:prepared.sha256,catalogueSha256:createHash('sha256').update(source).digest('hex'),engineVersion:engine,hostedVersionReadOnlyObserved:170011,notNullViaExactAttribute:true,oldChecksPreserved:true,hosted:false,nativeAcceptance:false,residue}));
 }finally{await db.close();}
});
