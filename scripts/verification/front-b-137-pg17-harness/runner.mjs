/** PG17 synthetic observation. Integration-only: scratch execution is refused.
 * No hosted database, Supabase credentials, filesystem mounts, or service input. */
import { randomBytes,createHash } from 'node:crypto';
import { readFile,lstat,realpath,mkdtemp,rmdir } from 'node:fs/promises';
import { resolve,relative,join,isAbsolute,posix,dirname,basename } from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const BASE='scripts/verification/front-b-137-pg17-harness/';
const REF='refs/heads/codex/front-b-137-pg17-observation';
const ID=/^[a-f0-9]{64}$/,SHA=/^[a-f0-9]{40}$/;
const allow=new Set(['PATH','LANG','LC_ALL','TZ','CI','GITHUB_ACTIONS','RUNNER_TEMP','GITHUB_SHA','GITHUB_REF','GITHUB_EVENT_NAME','SC_METRICS_PG17_RUN']);
const sources=['runner.mjs','scenario.mjs','invocation.mjs','offline-contract.mjs','source-binding.mjs','fixture-and-tests.sql.txt','candidate.sql.txt','reviewed-proposal.sql.txt','runner.test.mjs','scenario.test.mjs','offline-contract.test.mjs','source-binding.test.mjs'].map(x=>BASE+x);
const upstream={generatorBytes:'scripts/verification/front-b-metrics-dictionary-draft/generate.mjs',pathsBytes:'scripts/verification/front-b-metrics-dictionary-draft/paths.mjs',dictionaryBytes:'scripts/verification/front-b-metrics-dictionary-draft/origin-dictionary.json',baseBytes:'supabase/operations/candidates/20261101030000_signup_metrics.sql'};
const SAFE_PATH='/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';
// Reviewed closure of the existing process group implementation; update only after review.
const pins=[
 ['scripts/verification/auth-local-ci.mjs',70895,'bc1c2b27124ba05bd896fd72c5f8144fa85f0703db7eb641b3b9887f3591136b'],
 ['tests/e2e-auth-local/identity-data-api-contract.mjs',19896,'75f0adde06c81d9a3a068ac9873a6eeb09eff41952c1b02a3cfe1a9341e9f4aa'],
 ['tests/e2e-auth-local/capture-task-persistence-contract.mjs',8146,'f28aa8e3ae0f37821ab6e7b2ccbc13fc0b50fadd9c39c9b599ae8dd2917b6009'],
 ['tests/e2e-auth-local/qualified-chromium.mjs',6809,'70097633fa0a16a196e84e4cf0dd6b8908c78578be40ba09a553df515998cd2b'],
 ['tests/e2e-auth-local/browser-process-environment.mjs',747,'ffe33d1ec57378b04d18c180dd6601589cf4f3f82721d92be53ca1aa31d82a99'],
 ['tests/e2e-auth-local/auth-local-lifecycle-contract.mjs',6649,'fff2bfb451fd9cb523f4712bb7912d2521629eff844e33574354647c453c5a4f'],
 ['tests/helpers/canonical-release-source.mjs',9939,'6bbe4329fb5f5647d44497e4d8d39de835735a72ee8845a8af949138fdd68fea'],
 ['tests/helpers/canonical-front-b-source.mjs',6638,'fcdbeb291832d3025d3551d42e47fb8b20ecbf1b7fe294990b6be25d41202040'],
];
export const BOOTSTRAP_PATHS=Object.freeze(pins.map(([path])=>path));
const fail=()=>{throw Error('SYNTHETIC_OBSERVATION_REFUSED');};
const hash=x=>createHash('sha256').update(x).digest('hex');
export function checkEnvironment(env,platform=process.platform){
 const desc=Object.getOwnPropertyDescriptors(env??{});
 if(platform!=='linux'||Reflect.ownKeys(desc).some(k=>typeof k!=='string'||!allow.has(k)||!Object.hasOwn(desc[k],'value')||typeof desc[k].value!=='string'||desc[k].value.includes('\0'))||env.CI!=='true'||env.GITHUB_ACTIONS!=='true'||env.GITHUB_EVENT_NAME!=='push'||env.GITHUB_REF!==REF||env.SC_METRICS_PG17_RUN!=='1'||!SHA.test(env.GITHUB_SHA??'')||env.PATH!==SAFE_PATH||!posix.isAbsolute(env.RUNNER_TEMP??'')||posix.resolve(env.RUNNER_TEMP)!==env.RUNNER_TEMP)fail();
}
export function checkIntegratedPath(path){if(path!==BASE+'runner.mjs')fail();}
export function checkBootstrapSources(values){if(!(values instanceof Map)||pins.some(([p,n,h])=>!Buffer.isBuffer(values.get(p))||values.get(p).length!==n||hash(values.get(p))!==h))fail();}
export function checkReadonlyContainer(o){if(o?.HostConfig?.ReadonlyRootfs!==true||o.HostConfig.NetworkMode!=='none'||o.HostConfig.Privileged!==false)fail();}
export async function cleanupTemporaryHome(home,parent){
 if(typeof home!=='string'||typeof parent!=='string'||dirname(home)!==parent||!/^sc-metrics-[A-Za-z0-9]{6}$/.test(basename(home))||await realpath(parent)!==parent)fail();
 const st=await lstat(home);if(!st.isDirectory()||st.isSymbolicLink()||await realpath(home)!==home)fail();
 // No recursive deletion, and no deletion of unexpected files.
 await rmdir(home);
}
const json=s=>{if(typeof s!=='string'||Buffer.byteLength(s)>1_000_000||s.trim().split(/\r?\n/).length!==1)fail();try{return JSON.parse(s.trim());}catch{return fail();}};
const ROOT=resolve(process.cwd());
async function source(path){const file=resolve(ROOT,path),inside=relative(ROOT,file);if(!inside||inside==='..'||inside.startsWith('../')||isAbsolute(inside))fail();const st=await lstat(file);if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||await realpath(file)!==file||st.size>2_097_152)fail();return readFile(file);}

export async function execute(env=process.env){
 checkEnvironment(env);checkIntegratedPath(relative(ROOT,fileURLToPath(import.meta.url)).replaceAll('\\','/'));
 if(await realpath(ROOT)!==ROOT||await realpath(env.RUNNER_TEMP)!==env.RUNNER_TEMP)fail();
 const home=await mkdtemp(join(env.RUNNER_TEMP,'sc-metrics-'));
 try {
 const os={PATH:SAFE_PATH,HOME:home,LANG:env.LANG??'C.UTF-8',LC_ALL:env.LC_ALL??'C.UTF-8',TZ:'UTC',NO_COLOR:'1',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_SYSTEM:'/dev/null',GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'core.fsmonitor',GIT_CONFIG_VALUE_0:'false',GIT_TERMINAL_PROMPT:'0',DOCKER_HOST:'unix:///var/run/docker.sock',DOCKER_CONFIG:join(home,'no-docker-config')};
 // Bootstrap git reads only; no writes, no network, before imported closures.
 const git=async args=>(await promisify(execFile)('git',args,{cwd:ROOT,env:os,timeout:15000,maxBuffer:2_097_152,windowsHide:true})).stdout;
 if((await git(['rev-parse','HEAD'])).trim()!==env.GITHUB_SHA||(await git(['status','--porcelain','--untracked-files=all'])).trim())fail();
 const initial=new Map();for(const p of [...sources,...Object.values(upstream),...pins.map(x=>x[0])]){const bytes=await source(p),blob=Buffer.from(await git(['show','HEAD:'+p]));if(!bytes.equals(blob))fail();initial.set(p,bytes);}
 checkBootstrapSources(initial);
 const {verifyGeneratorSources,verifyBinding}=await import(pathToFileURL(join(ROOT,BASE+'source-binding.mjs')).href);
 const sourceInputs=Object.fromEntries(Object.entries(upstream).map(([key,path])=>[key,initial.get(path)]));
 verifyGeneratorSources(sourceInputs);
 const {compileDictionary}=await import(pathToFileURL(join(ROOT,upstream.generatorBytes)).href);
 verifyBinding({...sourceInputs,candidateBytes:initial.get(BASE+'candidate.sql.txt'),proposalBytes:initial.get(BASE+'reviewed-proposal.sql.txt')},compileDictionary);
 const {runBoundedProcess}=await import(pathToFileURL(join(ROOT,'scripts/verification/auth-local-ci.mjs')).href);
 const {IMAGE,requireImage,requireOfflineContainer}=await import(pathToFileURL(join(ROOT,BASE+'offline-contract.mjs')).href);
 const {buildInvocation}=await import(pathToFileURL(join(ROOT,BASE+'invocation.mjs')).href);
 // Validate both fixed inputs before any Docker invocation or container creation.
 buildInvocation({containerId:'0'.repeat(64),nonce:'0'.repeat(32),systemIdentifier:'1'.repeat(16),candidateBytes:initial.get(BASE+'candidate.sql.txt'),fixtureBytes:initial.get(BASE+'fixture-and-tests.sql.txt')});
 let groupKnown=true;const pending=new Set();
 const run=async(args,timeout,options={})=>{const p=runBoundedProcess('docker',args,{cwd:ROOT,env:os,timeoutMs:timeout,maxBytes:1_000_000,...options});pending.add(p);try{const v=await p;if(v?.groupConfirmed!==true){groupKnown=false;fail();}return v;}catch(e){if(e?.groupConfirmed!==true||e?.code!=='COMMAND_FAILED')groupKnown=false;throw e;}finally{pending.delete(p);}};
 const docker=async(args,timeout=30000,opts={})=>run(args,timeout,opts);
 const list=async filter=>(await docker(['ps','--all','--no-trunc','--quiet','--filter',filter])).stdout.trim().split(/\r?\n/).filter(Boolean);
 const inspect=async id=>json((await docker(['inspect','--format','{{json .}}',id])).stdout);
 const nonce=randomBytes(16).toString('hex'),name='sc-front-b-offline-'+nonce,label='sc.front-b-offline='+nonce;
 const owned=async()=>{const names=await list('name=^/'+name+'$'),labels=await list('label='+label);if(names.length>1||JSON.stringify(names)!==JSON.stringify(labels)||names.some(x=>!ID.test(x)))fail();return names[0]??null;};
 let id=null,imageId=null,attempted=false,problem=null,removed=false;
 try{
  if(await owned()!==null)fail();
  await docker(['pull','--platform','linux/amd64',IMAGE],300000,{capture:false});
  imageId=requireImage(json((await docker(['image','inspect','--format','{{json .}}',IMAGE])).stdout));
  attempted=true;
  id=(await docker(['create','--platform','linux/amd64','--name',name,'--label',label,'--network','none','--read-only','--tmpfs','/var/lib/postgresql/data:rw,nosuid,nodev,size=536870912','--tmpfs','/var/run/postgresql:rw,nosuid,nodev,size=16777216','--tmpfs','/tmp:rw,nosuid,nodev,size=16777216','--env','POSTGRES_HOST_AUTH_METHOD=trust',IMAGE],60000)).stdout.trim();
  if(!ID.test(id)||await owned()!==id)fail();
  let state=await inspect(id);requireOfflineContainer(state,id,name,imageId,nonce,false);checkReadonlyContainer(state);
  await docker(['start',id]);state=await inspect(id);requireOfflineContainer(state,id,name,imageId,nonce);checkReadonlyContainer(state);
  const psql=async(database,input)=>docker(['exec','--interactive','--user','postgres',id,'psql','--no-psqlrc','--no-password','--quiet','--tuples-only','--no-align','--set','ON_ERROR_STOP=1','--host','/var/run/postgresql','--username','postgres','--dbname',database,'--file=-'],60000,{input,capture:true});
  let info;const probe="select jsonb_build_object('database',current_database(),'owner',current_user,'local',inet_server_addr() is null and inet_client_addr() is null,'version',current_setting('server_version_num')::int,'system',(select system_identifier::text from pg_control_system()));";
  for(let i=0;i<60;i++){try{info=json((await psql('postgres',probe)).stdout);break;}catch(e){if(!groupKnown)throw e;await new Promise(r=>setTimeout(r,1000));}}
  if(info?.database!=='postgres'||info?.owner!=='postgres'||info?.local!==true||!Number.isSafeInteger(info?.version)||info.version<170000||info.version>=180000||!/^\d{16,20}$/.test(info?.system??''))fail();
  const sys=info.system;
  const guard=db=>`do $sc_boot$ begin if current_user<>'postgres' or current_database()<>'${db}' or inet_server_addr() is not null or inet_client_addr() is not null or current_setting('server_version_num')::int<170000 or current_setting('server_version_num')::int>=180000 or (select system_identifier::text from pg_control_system())<>'${sys}' then raise exception 'SYNTHETIC_TARGET_REFUSED'; end if; end $sc_boot$;\n`;
  await psql('postgres',guard('postgres')+"do $sc_absent$ begin if exists(select 1 from pg_database where datname='sc_metrics_fixture') then raise exception 'SYNTHETIC_DATABASE_EXISTS'; end if; end $sc_absent$;\ncreate database sc_metrics_fixture;\n");
  await psql('sc_metrics_fixture',guard('sc_metrics_fixture')+`begin;create schema sc_front_b_observation;revoke all on schema sc_front_b_observation from public;create table sc_front_b_observation.marker(nonce text primary key,system_identifier text not null);revoke all on sc_front_b_observation.marker from public;insert into sc_front_b_observation.marker values('${nonce}','${sys}');commit;`);
  state=await inspect(id);requireOfflineContainer(state,id,name,imageId,nonce);checkReadonlyContainer(state);
  const invocation=buildInvocation({containerId:id,nonce,systemIdentifier:sys,candidateBytes:initial.get(BASE+'candidate.sql.txt'),fixtureBytes:initial.get(BASE+'fixture-and-tests.sql.txt')});
  const observed=await docker(invocation.args,60000,{input:invocation.stdin,capture:true});if(observed.stdout!==invocation.expectedStdout)fail();
  const after=json((await psql('sc_metrics_fixture',guard('sc_metrics_fixture')+`select jsonb_build_object('marker',(select count(*) from sc_front_b_observation.marker where nonce='${nonce}' and system_identifier='${sys}'),'auth',to_regnamespace('auth') is null,'private',to_regnamespace('app_private') is null,'profiles',to_regclass('public.profiles') is null,'roles',(select count(*) from pg_roles where rolname in ('anon','authenticated','service_role')));`)).stdout);
  if(after?.marker!==1||after.auth!==true||after.private!==true||after.profiles!==true||after.roles!==0)fail();
  state=await inspect(id);requireOfflineContainer(state,id,name,imageId,nonce);checkReadonlyContainer(state);
  for(const [p,b] of initial)if(!(await source(p)).equals(b))fail();
  if((await git(['rev-parse','HEAD'])).trim()!==env.GITHUB_SHA||(await git(['status','--porcelain','--untracked-files=all'])).trim())fail();
 }catch(e){problem=e;}
 finally{
  if(groupKnown&&pending.size===0){try{const found=await owned();if(id&&found!==id)fail();if(!id)id=found;if(id){const state=await inspect(id);requireOfflineContainer(state,id,name,imageId,nonce,state.State?.Running);checkReadonlyContainer(state);await docker(['rm','--force','--volumes',id],60000,{capture:false});}if(await owned()!==null||id&&(await list('id='+id)).length!==0)fail();await docker(['info','--format','{{json .ID}}']);removed=true;}catch{removed=false;}}
 }
 if(problem||!removed||!groupKnown||pending.size||attempted&&!id)fail();
 return {status:'OBSERVED',scenario:'metrics-catalog-pg17-synthetic',sourceSha:env.GITHUB_SHA,image:IMAGE,acceptance:false,hostedCertified:false,syntheticAuth:true};
 } finally {
  // Delete only the empty, uniquely created HOME; never recursively remove contents.
  await cleanupTemporaryHome(home,env.RUNNER_TEMP);
 }
}

export async function main(argv=process.argv.slice(2),env=process.env,emit=x=>process.stdout.write(JSON.stringify(x)+'\n')){
 if(argv.length===0||argv.length===1&&argv[0]==='--help'){emit({code:'NO_SERVICE_STARTED',acceptance:false});return 0;}
 if(argv.length!==1||argv[0]!=='--execute'){emit({code:'SYNTHETIC_OBSERVATION_REFUSED',acceptance:false});return 1;}
 try{emit(await execute(env));return 0;}catch{emit({code:'SYNTHETIC_OBSERVATION_REFUSED',acceptance:false});return 1;}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)process.exitCode=await main();
