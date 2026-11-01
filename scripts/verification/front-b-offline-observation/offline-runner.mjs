/** REVIEW DRAFT: offline PG17 synthetic fixture. Never a Supabase/ledger proof.
 * Scratch copy refuses execution before any process; a reviewed Git integration
 * and an explicitly separate job are prerequisites for a native observation. */
import {randomBytes,createHash} from 'node:crypto';
import {readFile,lstat,realpath} from 'node:fs/promises';
import {resolve,relative,join,isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const ROOT=resolve(process.cwd()),SHA=/^[a-f0-9]{40}$/,ID=/^[a-f0-9]{64}$/;
const BASE='scripts/verification/front-b-offline-observation/';
const required=['offline-runner.mjs','offline-contract.mjs','contract.mjs','container-fixture.sql'];
const sqlInputs=['supabase/operations/onboarding-conflict-code.sql','supabase/operations/candidates/20261101020254_public_admission_gate.sql','supabase/operations/candidates/20261101030000_signup_metrics.sql','supabase/operations/candidates/20261101013633_feedback_requests.sql','supabase/operations/verify-onboarding-conflict-code.sql','supabase/operations/verify-front-b-additive.sql','supabase/operations/verify-front-b-signup-disabled.sql','supabase/tests/release-catalog.sql'];
// Complete local import closure of auth-local-ci.mjs, reviewed before import.
export const BOOTSTRAP_PINS=Object.freeze([
 ['scripts/verification/auth-local-ci.mjs',70200,'dd9a796b5c9ed423fa366db3ec0ceae8b249f72d7c613530edaf599c98beea0e'],
 ['tests/e2e-auth-local/identity-data-api-contract.mjs',19896,'75f0adde06c81d9a3a068ac9873a6eeb09eff41952c1b02a3cfe1a9341e9f4aa'],
 ['tests/e2e-auth-local/capture-task-persistence-contract.mjs',8146,'f28aa8e3ae0f37821ab6e7b2ccbc13fc0b50fadd9c39c9b599ae8dd2917b6009'],
 ['tests/e2e-auth-local/qualified-chromium.mjs',6809,'70097633fa0a16a196e84e4cf0dd6b8908c78578be40ba09a553df515998cd2b'],
 ['tests/e2e-auth-local/browser-process-environment.mjs',747,'ffe33d1ec57378b04d18c180dd6601589cf4f3f82721d92be53ca1aa31d82a99'],
 ['tests/e2e-auth-local/auth-local-lifecycle-contract.mjs',6649,'fff2bfb451fd9cb523f4712bb7912d2521629eff844e33574354647c453c5a4f'],
 ['tests/helpers/canonical-release-source.mjs',9939,'6bbe4329fb5f5647d44497e4d8d39de835735a72ee8845a8af949138fdd68fea'],
].map(([path,bytes,sha256])=>Object.freeze({path,bytes,sha256})));
const fixtureHash='cb23224f775e434d84127502c728d2c2bb37e81c4ec1ab2eba1d0900b919b571';
const allowed=new Set(['PATH','LANG','LC_ALL','TZ','CI','GITHUB_ACTIONS','RUNNER_TEMP','GITHUB_SHA','SC_AUTH_LOCAL_CI_RUN','SC_FRONT_B_OFFLINE_OBSERVATION']);
const fail=()=>{throw Error('OFFLINE_REFUSED');};
const digest=b=>createHash('sha256').update(b).digest('hex');
export function verifyBootstrapSources(values){if(!(values instanceof Map)||BOOTSTRAP_PINS.some(pin=>{const b=values.get(pin.path);return !Buffer.isBuffer(b)||b.length!==pin.bytes||digest(b)!==pin.sha256;}))fail();}
export function checkEnvironment(env,platform=process.platform){
 const ds=Object.getOwnPropertyDescriptors(env??{}),keys=Reflect.ownKeys(ds);
 if(keys.some(k=>typeof k!=='string'||!allowed.has(k)||!Object.hasOwn(ds[k],'value')||typeof ds[k].value!=='string'||ds[k].value.includes('\0'))||platform!=='linux'||env.CI!=='true'||env.GITHUB_ACTIONS!=='true'||env.SC_AUTH_LOCAL_CI_RUN!=='1'||env.SC_FRONT_B_OFFLINE_OBSERVATION!=='1'||!SHA.test(env.GITHUB_SHA??'')||!env.PATH||!isAbsolute(env.RUNNER_TEMP??'')||resolve(env.RUNNER_TEMP)!==env.RUNNER_TEMP)fail();
}
export function checkIntegratedPath(path){if(path!==BASE+'offline-runner.mjs')fail();}
const relativeUrl=url=>relative(ROOT,fileURLToPath(url)).replaceAll('\\','/');
async function source(path){const file=resolve(ROOT,path),inside=relative(ROOT,file);if(!inside||inside==='..'||inside.startsWith('../')||isAbsolute(inside))fail();const st=await lstat(file);if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||await realpath(file)!==file||st.size>2097152)fail();return readFile(file);}
export function fixtureFromUpstream(bytes){
 if(!Buffer.isBuffer(bytes))fail();const text=bytes.toString('utf8'),matches=[...text.matchAll(/const INFRASTRUCTURE = `([\s\S]*?)`;/g)];
 if(matches.length!==1)return fail();return Buffer.from(matches[0][1]);
}
function json(text){if(typeof text!=='string'||Buffer.byteLength(text)>2097152||text.trim().split(/\r?\n/).length!==1)fail();return JSON.parse(text.trim());}

export async function execute(env=process.env){
 checkEnvironment(env);checkIntegratedPath(relativeUrl(import.meta.url));
 if(await realpath(ROOT)!==ROOT||await realpath(env.RUNNER_TEMP)!==env.RUNNER_TEMP)fail();
 const os={PATH:env.PATH,HOME:env.RUNNER_TEMP,LANG:env.LANG??'C.UTF-8',LC_ALL:env.LC_ALL??'C.UTF-8',TZ:'UTC',NO_COLOR:'1',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_SYSTEM:'/dev/null',GIT_TERMINAL_PROMPT:'0',DOCKER_HOST:'unix:///var/run/docker.sock',DOCKER_CONFIG:join(env.RUNNER_TEMP,'sc-docker-empty-'+randomBytes(16).toString('hex'))};
 const git=async args=>(await promisify(execFile)('git',args,{cwd:ROOT,env:os,timeout:15000,maxBuffer:2097152,windowsHide:true})).stdout;
 if((await git(['rev-parse','HEAD'])).trim()!==env.GITHUB_SHA||(await git(['status','--porcelain','--untracked-files=all'])).trim())fail();
 const paths=[...required.map(x=>BASE+x),...BOOTSTRAP_PINS.map(p=>p.path),'tests/scripts/helpers/catalogue-fixture.mjs',...sqlInputs];
 const initial=new Map();for(const path of paths){const b=await source(path),g=Buffer.from(await git(['show','HEAD:'+path]));if(!b.equals(g))fail();initial.set(path,b);}
 const fixture=initial.get(BASE+'container-fixture.sql');if(fixture.length!==2972||digest(fixture)!==fixtureHash||!fixture.equals(fixtureFromUpstream(initial.get('tests/scripts/helpers/catalogue-fixture.mjs'))))fail();
 verifyBootstrapSources(initial);
 const {OBSERVATION_PINS,verifyObservationSources,observeCatalogue}=await import(pathToFileURL(join(ROOT,BASE+'contract.mjs')).href);
 const {IMAGE,requireImage,requireOfflineContainer,sameSessionGuard,requireSqlBytes,requireSameResults}=await import(pathToFileURL(join(ROOT,BASE+'offline-contract.mjs')).href);
 if(JSON.stringify(OBSERVATION_PINS.map(pin=>pin.path))!==JSON.stringify(sqlInputs))fail();
 const extra=verifyObservationSources(OBSERVATION_PINS.map(pin=>({path:pin.path,source:initial.get(pin.path)})));
 const {runBoundedProcess}=await import(pathToFileURL(join(ROOT,'scripts/verification/auth-local-ci.mjs')).href);
 const {readCurrent27CanonicalMigrations}=await import(pathToFileURL(join(ROOT,'tests/helpers/canonical-release-source.mjs')).href);
 const migrations=await readCurrent27CanonicalMigrations(ROOT);
 const canonicalFiles=['supabase/sql-editor/manifest.json',...migrations.flatMap((row,i)=>['supabase/migrations/'+row.file,'supabase/sql-editor/installation/'+String(i+1).padStart(3,'0')+'_'+row.file])];
 for(const path of canonicalFiles){const b=await source(path),g=Buffer.from(await git(['show','HEAD:'+path]));if(!b.equals(g))fail();initial.set(path,b);}
 let groupKnown=true;const pending=new Set();
 const run=async(cmd,args,timeout,options={})=>{const p=runBoundedProcess(cmd,args,{cwd:ROOT,env:os,timeoutMs:timeout,maxBytes:2097152,...options});pending.add(p);try{const v=await p;if(v?.groupConfirmed!==true){groupKnown=false;fail();}return v;}catch(error){if(error?.groupConfirmed!==true)groupKnown=false;throw error;}finally{pending.delete(p);}};
 let id=null,imageId=null,created=false,observation,negative,problem=null,verifiedRemoval=false;
 const nonce=randomBytes(16).toString('hex'),name='sc-front-b-offline-'+nonce,label='sc.front-b-offline='+nonce;
 const docker=async(args,timeout=30000,options={})=>run('docker',args,timeout,options);
 const list=async filter=>(await docker(['ps','--all','--no-trunc','--quiet','--filter',filter])).stdout.trim().split(/\r?\n/).filter(Boolean);
 const inspect=async target=>json((await docker(['inspect','--format','{{json .}}',target])).stdout);
 const owned=async()=>{const byName=await list('name=^/'+name+'$'),byLabel=await list('label='+label);if(byName.length>1||byLabel.length>1||JSON.stringify(byName)!==JSON.stringify(byLabel)||byName.some(v=>!ID.test(v)))fail();return byName[0]??null;};
 try{
  if(migrations.length!==27||await owned()!==null)fail();
  await docker(['pull','--platform','linux/amd64',IMAGE],300000,{capture:false});
  const image=json((await docker(['image','inspect','--format','{{json .}}',IMAGE])).stdout);imageId=requireImage(image);
  // The generated name and label are registered before creation, for recovery.
  created=true;const creation=await docker(['create','--platform','linux/amd64','--name',name,'--label',label,'--network','none','--read-only','--tmpfs','/var/lib/postgresql/data:rw,nosuid,nodev,size=536870912','--tmpfs','/var/run/postgresql:rw,nosuid,nodev,size=16777216','--tmpfs','/tmp:rw,nosuid,nodev,size=16777216','--env','POSTGRES_HOST_AUTH_METHOD=trust',IMAGE],60000);
  id=creation.stdout.trim();if(!ID.test(id)||await owned()!==id)fail();
  requireOfflineContainer(await inspect(id),id,name,imageId,nonce,false);
  await docker(['start',id],30000,{capture:false});
  const before=await inspect(id);requireOfflineContainer(before,id,name,imageId,nonce);
  const psql=async input=>(await docker(['exec','--interactive','--user','postgres',id,'psql','--no-psqlrc','--no-password','--quiet','--tuples-only','--no-align','--set','ON_ERROR_STOP=1','--host','/var/run/postgresql','--username','postgres','--dbname','postgres','--file=-'],60000,{input,capture:true})).stdout;
  const probe="select jsonb_build_object('database',current_database(),'owner',current_user,'version',current_setting('server_version_num')::integer,'systemIdentifier',(select system_identifier::text from pg_control_system()));";
  let instance;for(let attempt=0;attempt<60;attempt++){try{instance=json(await psql(probe));break;}catch(error){if(!groupKnown)throw error;await new Promise(done=>setTimeout(done,1000));}}
  if(!instance||instance.database!=='postgres'||instance.owner!=='postgres'||!Number.isSafeInteger(instance.version)||instance.version<170000||instance.version>=180000||!/^\d{16,20}$/.test(instance.systemIdentifier))fail();
  const systemIdentifier=instance.systemIdentifier;
  await psql(`begin;do $sc_boot$ begin if current_user<>'postgres' or current_database()<>'postgres' or inet_server_addr() is not null or inet_client_addr() is not null or current_setting('server_version_num')::integer<170000 or current_setting('server_version_num')::integer>=180000 or (select system_identifier::text from pg_control_system())<>'${systemIdentifier}' then raise exception 'OFFLINE_INSTANCE_REFUSED';end if;end $sc_boot$;create schema sc_front_b_observation;revoke all on schema sc_front_b_observation from public;create table sc_front_b_observation.marker(nonce text primary key,system_identifier text not null);revoke all on sc_front_b_observation.marker from public;insert into sc_front_b_observation.marker values('${nonce}','${systemIdentifier}');commit;`);
  const exec=async input=>psql(sameSessionGuard(nonce,systemIdentifier)+requireSqlBytes(Buffer.from(input)).toString('utf8'));
  await exec(fixture.toString('utf8'));for(const migration of migrations)await exec(migration.source.toString('utf8'));
  for(const index of [0,1,2,3])await exec(extra[index].source.toString('utf8'));
  const sql=i=>extra[i].source.toString('utf8');
  const membershipSql="begin transaction read only; select jsonb_build_object('anon',pg_has_role('anon','service_role','MEMBER'),'authenticated',pg_has_role('authenticated','service_role','MEMBER'),'members',(select count(*) from pg_roles r where r.oid<>'service_role'::regrole and pg_has_role(r.oid,'service_role','MEMBER')));rollback;";
  const snapshot=async()=>({historical:json(await exec(sql(7))),patch:json(await exec(sql(4))),additive:json(await exec('begin transaction read only;\n'+sql(5)+'\nrollback;')),signup:json(await exec('begin transaction read only;\n'+sql(6)+'\nrollback;')),membership:json(await exec(membershipSql))});
  const first=await snapshot();observation=observeCatalogue(first.historical,instance.version);
  if(first.patch?.check!=='onboarding_conflict_patch_pt409'||typeof first.patch.ok!=='boolean'||first.additive?.check!=='front_b_additive_catalogue'||typeof first.additive.ok!=='boolean'||!Array.isArray(first.additive.failures)||first.additive.ok!==(first.additive.failures.length===0)||first.signup?.check!=='front_b_signup_database_gate_disabled'||typeof first.signup.ok!=='boolean')fail();
  const historic=json(await exec('begin;grant select on public.profiles to anon;\n'+sql(7))),patch=json(await exec('begin;grant execute on function public.onboarding_call(uuid,uuid,text,jsonb) to authenticated;\n'+sql(4))),additive=json(await exec('begin;alter table app_private.onboarding_entries drop constraint onboarding_entry_source_check;alter table app_private.onboarding_entries add constraint onboarding_entry_source_check check(true);\n'+sql(5)+'\nrollback;')),signup=json(await exec('begin;insert into app_private.signup_settings(singleton,enabled) values(true,true);\n'+sql(6)+'\nrollback;'));
  const member=json(await exec("begin;create role sc_front_b_fixture nologin;grant service_role to sc_front_b_fixture;select jsonb_build_object('inherited',pg_has_role('sc_front_b_fixture','service_role','MEMBER'));rollback;"));
  const key=v=>v?.check==='anonymous_table_closed'&&v?.object==='public.profiles';
  negative={historicalDetected:!first.historical.deviations.some(key)&&Array.isArray(historic?.deviations)&&historic.deviations.some(key),patchDetected:first.patch.ok===true&&patch?.ok===false,additiveDetected:first.additive.ok===true&&additive?.ok===false,signupDetected:first.signup.ok===true&&signup?.ok===false,membershipInheritanceObserved:member?.inherited===true};
  const after=await snapshot();requireSameResults(first,after);
  requireOfflineContainer(await inspect(id),id,name,imageId,nonce);
  for(const [path,b] of initial)if(!(await source(path)).equals(b))fail();
  if((await git(['rev-parse','HEAD'])).trim()!==env.GITHUB_SHA)fail();
  observation={...observation,patch:first.patch.ok,additive:first.additive.ok,signupDisabled:first.signup.ok,membership:first.membership};
 }catch(error){problem=error;}
 finally{
  if(groupKnown&&pending.size===0){
   try{
    const discovered=await owned();if(id&&discovered!==id)fail();if(!id)id=discovered;
    if(id){const state=await inspect(id);requireOfflineContainer(state,id,name,imageId,nonce,state.State?.Running);await docker(['rm','--force','--volumes',id],60000,{capture:false});}
    if(await owned()!==null||id&&(await list('id='+id)).length!==0)fail();
    // A successful Docker daemon query distinguishes absence from CLI failure.
    await docker(['info','--format','{{json .ID}}']);verifiedRemoval=true;
   }catch{verifiedRemoval=false;}
  }
 }
 if(problem||!verifiedRemoval||!groupKnown||pending.size||created&&id===null)fail();
 return {scenario:'front-b-offline-pg17-synthetic',status:Object.values(negative).every(Boolean)?'OBSERVED':'INCONCLUSIVE',sourceSha:env.GITHUB_SHA,localOnly:true,acceptance:false,hostedCertified:false,cliLedgerCertified:false,syntheticAuthStorage:true,observation,negative};
}

export async function main(argv=process.argv.slice(2),env=process.env,output=v=>process.stdout.write(JSON.stringify(v)+'\n')){
 if(!argv.length||argv.length===1&&argv[0]==='--help'){output({code:'NO_SERVICE_STARTED',acceptance:false});return 0;}
 if(argv.length!==1||argv[0]!=='--execute'){output({code:'OFFLINE_REFUSED',acceptance:false});return 1;}
 try{const value=await execute(env);output(value);return value.status==='OBSERVED'?0:1;}catch{output({code:'OFFLINE_REFUSED',acceptance:false});return 1;}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)process.exitCode=await main();
