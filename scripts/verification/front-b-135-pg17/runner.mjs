/** Scratch integration candidate; no hosted endpoints. Never run outside reviewed Git CI. */
import {randomBytes,createHash} from 'node:crypto';
import {readFile,lstat,realpath,mkdtemp} from 'node:fs/promises';
import {resolve,join,relative,isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
const BASE='scripts/verification/front-b-135-pg17/',ROOT=resolve(process.cwd());
const AUTH_PINS=[
 ['scripts/verification/auth-local-ci.mjs','bc1c2b27124ba05bd896fd72c5f8144fa85f0703db7eb641b3b9887f3591136b'],
 ['tests/e2e-auth-local/identity-data-api-contract.mjs','75f0adde06c81d9a3a068ac9873a6eeb09eff41952c1b02a3cfe1a9341e9f4aa'],
 ['tests/e2e-auth-local/capture-task-persistence-contract.mjs','f28aa8e3ae0f37821ab6e7b2ccbc13fc0b50fadd9c39c9b599ae8dd2917b6009'],
 ['tests/e2e-auth-local/qualified-chromium.mjs','70097633fa0a16a196e84e4cf0dd6b8908c78578be40ba09a553df515998cd2b'],
 ['tests/e2e-auth-local/browser-process-environment.mjs','ffe33d1ec57378b04d18c180dd6601589cf4f3f82721d92be53ca1aa31d82a99'],
 ['tests/e2e-auth-local/auth-local-lifecycle-contract.mjs','fff2bfb451fd9cb523f4712bb7912d2521629eff844e33574354647c453c5a4f'],
 ['tests/helpers/canonical-release-source.mjs','6bbe4329fb5f5647d44497e4d8d39de835735a72ee8845a8af949138fdd68fea'],
 ['tests/helpers/canonical-front-b-source.mjs','fcdbeb291832d3025d3551d42e47fb8b20ecbf1b7fe294990b6be25d41202040']
 ,['scripts/verification/front-b-signup-reservation-draft/candidate-reservation.sql.txt','18288441c5195279ad3b31bb3cf68ededd914fe0121533f8210fbbb33d843dd7']
 ];
const SAME_BROWSER_PINS=Object.freeze([
 ['scripts/verification/front-b-135-draft/admission-feedback-metrics-atomic.sql.txt','aca4ef373aec1ad3c2ddce859d412a5454e1cb06f457e395fdab5fbada6cacff'],
 ['scripts/verification/front-b-135-draft/same-browser-composed-v1.guarded.sql.txt','038f7a9fa96eaebcdee44b8974e41a1b13dd796651ca5d0fe12a56dcec7fb652']
]);
const LOCAL_PINS=Object.freeze({
 'recovery-ledger-bound.draft.mjs':'c367ab39f98ab2f20c0af6063ec0223029500b76de9dfa1ff6323fa5004c2f8b',
 'recovery-ledger-bound.guarded.sql.txt':'7b51eb4ea9b12deed1a969efdfc9368bd494ce2247af495f004c2cf6a92ac84c',
 'install-only.reviewable.sql.txt':'fab48cfdf12630643623e4e1d58251b3bcc35bc7c6c0f57d7d93e415514ddb00',
 'ledger-visibility-probe.draft.mjs':'94742c71529b24a0308844a6b63659ef18d647b94613c0c62ee85ca4c2969d5d',
 'ledger-visibility-probe.fail.sql.txt':'d29322fe522a256c8a669a1936a33735320ccd03e1a6a7bddc297a94dbedfdd9',
 'pending-origin-race.draft.mjs':'1dc9b5e22161a14fb28a0be7543d8896db5dd689b0a8d04b472447317ffdbe05',
 'pending-origin-v2.guarded.sql.txt':'7d34cef6d839dca2bbc71b37f62cb8818693ba3e06e203989c7e353f0088ac84',
 'origin-218-full-ledger.draft.mjs':'631ab61ad59e54af2e305b377a8a2c4602b82638cb73ec1a83a2f0d40049a1cf',
 'origin-218-quarantine.guarded.sql.txt':'3079f81cb88ca090286e8b664c5102361e3986c6639309514094277bfe21a58d',
 'origin-218-full-cutover.guarded.sql.txt':'e1d1bf04bb9723a7fa907b5c6a8d24154e87be93f9b993edcf36b8f0acff01aa',
 'origin-218-freeze-exception.draft.mjs':'2c54e51993b05d04fa9da2bd8335cdc03726617f45003b8604a2ab8b37454aca',
 'withdrawal-v2.fixture.sql':'25db90f494174bbe1ca13724bbd301f526a7f8e638ad53270749a24036d7c89a',
 'withdrawal-v2.guarded.sql.txt':'02ef5708f3d9bf74d4ecc7d1946461503eb20d6f4cbadd9b6fb98d7ac85ccdff',
 'withdrawal-v2-race.draft.mjs':'e8401a167b3d9356b5c56d7e83c56bf85796e6d9881a3bc24e1bf66009ea874b',
 'offline-contract.mjs':'538e2e31e3a69ac34029848beb414e6146f54bba4c39fbf32806c06c4193e707',
 'qualify.mjs':'8816d54b6d9b0265c024a6c86b5f235695eed800376522f202eb1b39060b825c',
 'race.mjs':'0ad7bd5665904b1ad87b3677abf50514041fcac126a74d4c866440b4de26e9ea',
 'session.mjs':'02f5bc09f3778c1d65917989fefd3959dc80c2a2d345e2288121abc1f2997acc',
 'cleanup.mjs':'41ee0a110504fc4b39817644b005ba3b2f849377c8356d338d5bbc52f49a2835',
 'fixture.sql':'db35f101300407095589e7279a7af23fc89bad2bab87e302bb3b5cb0673fbbe2',
 'reservation.sql.txt':'2ed365eb0943c25d3463b7a8578268d47e1813c39cadcacf3b3eac35094b42bc',
 'same-browser-fixture.sql':'47a07cae9e0686b8d98168e9f2a60c90532d735fa1cef22686f0a620d6f07a59',
 'same-browser-seed.sql':'d49f5436440bcf0b733f1cdfbc084f76ab5767ba20c420a229b9378b3071d6a0',
 'same-browser-qualify.mjs':'3605fe60dc5b085fb1fd86599b5a08d4db531b5ad0c9bcd9ad674d67a4316a03',
 'same-browser-retention-races.draft.mjs':'a0dac01de4a42a416e1a18a79bd31b8f5a10ec82364a36ddd60000577cea0631',
 'legacy-prune-race.draft.mjs':'ce5bfb56894952d5191f2a53e77aab87beab01994efa65359951656579516c8b',
 'persistent-freeze.quarantine.guarded.sql.txt':'d31c75970f93d9e04064a0369955e464b199b460cc25c71538fd7188d8455f25',
 'persistent-freeze-race.draft.mjs':'aaec8394612a75774e77ecbd19cbba71058381308cd9403e61d74f39463d89f5',
 'persistent-freeze-orders.draft.mjs':'c72a6a05c0f668fb9d6f797ca375fa4629f2fede0a1b3bb084f3c3179426ffd2',
 'full-cutover-transaction.draft.mjs':'2feb0431d3f97cf49cc68f82bc3fd3bcce7f73f16529b1a7a6929bd7c53557fc',
 'persistent-freeze.cutover.guarded.sql.txt':'68d6bb8677bae3f75ea5955d9a4dbf6688720cd4ec9500f808d527503a528f0f',
 'ledger-preflight.readonly.sql.txt':'21f4757e4be28ac872703724051512dd7ae149c5efcebd24128022af4bd2a141'
});
const SUPPORT_PINS=Object.freeze([
 [BASE+'recovery-ledger-bound.draft.test.mjs','cb9bb6325b7a134d49ed64e5e55d2547261fdac30dbdaeb72f5db448c0b4d232'],
 [BASE+'ledger-visibility-probe.draft.test.mjs','3a385b67ffe80318b0d0f68889b95760b7311ab6f0f688c9fbe1448a6285a0d8'],
 [BASE+'pending-origin-race.draft.test.mjs','60d75a26b898c54b9c8aec74edbc1de78bb576d5b8387e4a0b666c38b1ce96cb'],
 [BASE+'origin-218-full-ledger.draft.test.mjs','2afdb1127a77ec167fac50eac02daf014682cc15854240295926e5d1aff1b871'],
 [BASE+'runner.test.mjs','eae7d2876727ad56c62a4a7c987cd62d96785bfe9a61ed3e4b061223c8f39587'],
 [BASE+'origin-218-freeze-exception.draft.test.mjs','434324a5c05876aba211680fd8764a5e04de8bf3310c3e182199a9bc08b58e99'],
 [BASE+'withdrawal-v2-race.draft.test.mjs','7e246b335f59fa77f1585dc9bd440dfa61674943f4e6b95bd214ef74ac746b89'],
 [BASE+'full-cutover-transaction.draft.test.mjs','680ead06bfb0b9b6dd97e951f32ca21720a09c0c1f8ecf236ff8d42339c37165'],
 [BASE+'persistent-freeze-orders.draft.test.mjs','055585f6e0bdd89dd6ceb04ec64418bbde7d180c120dab34f4b9cced4463f723'],
 [BASE+'legacy-prune-race.draft.test.mjs','dd0175855b24f587978ebc2f91d80736e1071690a028a5bb73fb658a6f06b719'],
 [BASE+'persistent-freeze-race.draft.test.mjs','36075c338b3617563f93413e430689de17a988754af789c77b8e3ba73f96c4b9'],
 [BASE+'session.test.mjs','0d5abd786b5011ded73d60a1b25c365413df6516e7a598bc9064a99dd2ff15cc'],
 [BASE+'race.test.mjs','abc65232de672d573755e2c9b8a9dfbfc31833b33c6829cfa7511795bcbf6233'],
 [BASE+'qualify.test.mjs','34bf3c2caac26f380ceec8ac85eddebe691063880ab028ddcbf322ed1e3eec6d'],
 [BASE+'cleanup.test.mjs','8ed8aebf5635913c5653d29a427cd570e7513988481469fabd53593e1ffd1ccc'],
 [BASE+'offline-contract.test.mjs','9a044453c2a82033fc5dcc6afca527a3bfb7865aec49b76a4d113caae61a8dc8'],
 [BASE+'same-browser-retention-races.draft.test.mjs','697a313ae5bebbe5b9bee15326a4168fecf0abcb6ad011f6852380747d6583f9'],
 ['.nvmrc','68ca3fba3b7e864770cb61aeb306d4bd4354b68ab4dd38450860c5d823e42a53'],
 ['.github/workflows/front-b-135-pg17-races.yml','c6fd17f5ec523d19297f7d2d20fb1ae7ded7af3525eb4699614e5224ce7ddce5']
]);
const SHA=/^[a-f0-9]{40}$/,ID=/^[a-f0-9]{64}$/,digest=b=>createHash('sha256').update(b).digest('hex');
const SAFE_PATH='/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',REF='refs/heads/codex/front-b-135-pg17-races';
const allowed=new Set(['PATH','LANG','LC_ALL','TZ','CI','GITHUB_ACTIONS','GITHUB_EVENT_NAME','GITHUB_REF','RUNNER_TEMP','GITHUB_SHA','SC_FRONT_B_PG17_RACE']);
const fail=()=>{throw Error('RACE_RUNNER_REFUSED');};
export function environment(env,platform=process.platform){const descriptors=Object.getOwnPropertyDescriptors(env??{}),keys=Reflect.ownKeys(descriptors);if(platform!=='linux'||keys.some(k=>typeof k!=='string'||!allowed.has(k)||!Object.hasOwn(descriptors[k],'value')||typeof descriptors[k].value!=='string'||descriptors[k].value.includes('\0'))||env.CI!=='true'||env.GITHUB_ACTIONS!=='true'||env.GITHUB_EVENT_NAME!=='push'||env.GITHUB_REF!==REF||env.SC_FRONT_B_PG17_RACE!=='1'||!SHA.test(env.GITHUB_SHA??'')||env.PATH!==SAFE_PATH||!isAbsolute(env.RUNNER_TEMP??'')||resolve(env.RUNNER_TEMP)!==env.RUNNER_TEMP)fail();}
export function assertIntegratedPath(path){if(path!==BASE+'runner.mjs')fail();}
async function source(path){const p=resolve(ROOT,path),rel=relative(ROOT,p);if(!rel||rel.startsWith('..')||isAbsolute(rel))fail();const st=await lstat(p);if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||st.size>2097152||await realpath(p)!==p)fail();return readFile(p);}
function json(s){if(typeof s!=='string'||Buffer.byteLength(s)>65536||s.trim().split(/\r?\n/).length!==1)fail();return JSON.parse(s.trim());}
const pause=ms=>new Promise(resolveTimer=>setTimeout(resolveTimer,ms));
async function groupAbsent(pid){if(!Number.isSafeInteger(pid)||pid<2)return false;for(let i=0;i<20;i++){try{process.kill(-pid,0);}catch(e){return e?.code==='ESRCH';}await pause(50);}return false;}
export function mayTeardown(groupKnown,pending,states){return groupKnown===true&&pending===0&&Array.isArray(states)&&states.every(s=>s?.groupGone===true);}
export function receipt(sha,results,groupKnown,pending,allClean){
 if(!SHA.test(sha)||!mayTeardown(groupKnown,pending,[])||allClean!==true||!Array.isArray(results)||results.length!==23)fail();
 for(const [index,name] of ['reservation-exclusive-pg17','start-exclusive-pg17','same-browser-renewal-prune-pg17','same-browser-fence-prune-pg17','legacy-prune-resumes-after-replacement-pg17','legacy-prune-blocked-by-persistent-freeze-pg17','persistent-freeze-reverse-pg17','persistent-freeze-rollback-pg17','full-cutover-ledger-transaction-pg17','withdrawal-renew-first-pg17','withdrawal-withdraw-first-pg17','origin-218-freeze-commit-pg17','origin-218-freeze-rollback-pg17','origin-218-full-quarantine-synthetic-ledger-pg17','origin-218-full-cutover-synthetic-ledger-pg17','pending-origin-reserve-first-pg17','pending-origin-withdraw-reserve-pg17','pending-origin-finish-first-pg17','pending-origin-withdraw-finish-pg17','ledger-visibility-absent-pg17','ledger-visibility-visible-pg17','ledger-visibility-duplicate-pg17','recovery-ledger-bound-pg17'].entries()){const r=results[index];if(!r||Object.keys(r).sort().join(',')!=='acceptance,hostedCertified,scenario,status'||r.scenario!==name||r.status!=='CASE_OBSERVED_CLEANUP_PENDING'||r.acceptance!==false||r.hostedCertified!==false)fail();}
 return {scenario:'front-b-reservation-races-pg17',status:'OBSERVED',acceptance:false,hostedCertified:false,cleanupConfirmed:true,cases:23,sourceSha:sha};
}
export async function execute(env=process.env){
 environment(env);assertIntegratedPath(relative(ROOT,fileURLToPath(import.meta.url)).replaceAll('\\','/'));if(await realpath(ROOT)!==ROOT||await realpath(env.RUNNER_TEMP)!==env.RUNNER_TEMP||Object.keys(LOCAL_PINS).length!==32)fail();
 const os={PATH:SAFE_PATH,HOME:env.RUNNER_TEMP,LANG:env.LANG??'C.UTF-8',LC_ALL:env.LC_ALL??'C.UTF-8',TZ:'UTC',NO_COLOR:'1',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_SYSTEM:'/dev/null',GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'core.fsmonitor',GIT_CONFIG_VALUE_0:'false',GIT_TERMINAL_PROMPT:'0',DOCKER_HOST:'unix:///var/run/docker.sock'};
 const git=args=>execFileSync('git',['-c','gc.auto=0','-c','protocol.allow=never','-c','core.hooksPath=/dev/null',...args],{cwd:ROOT,env:os,timeout:15000,maxBuffer:2097152});
 if(git(['rev-parse','HEAD']).toString().trim()!==env.GITHUB_SHA||git(['status','--porcelain','--untracked-files=all']).toString().trim())fail();
 const pins=[...AUTH_PINS,...SAME_BROWSER_PINS,...SUPPORT_PINS,...Object.entries(LOCAL_PINS).map(([p,h])=>[BASE+p,h]),[BASE+'runner.mjs',null]];const bytes=new Map();
 for(const [path,hash] of pins){const b=await source(path);if(!b.equals(git(['show','HEAD:'+path]))||hash&&digest(b)!==hash)fail();bytes.set(path,b);}
 const {IMAGE,requireImage,requireOfflineContainer,sameSessionGuard,requireSqlBytes}=await import(pathToFileURL(join(ROOT,BASE+'offline-contract.mjs')).href);
 const {qualifySources}=await import(pathToFileURL(join(ROOT,BASE+'qualify.mjs')).href),{observeReservationRace,seedStartSql,nullCaseSql,nullBaselineSql}=await import(pathToFileURL(join(ROOT,BASE+'race.mjs')).href),{openDockerSession}=await import(pathToFileURL(join(ROOT,BASE+'session.mjs')).href),{removeEmptyOwnedDirectory}=await import(pathToFileURL(join(ROOT,BASE+'cleanup.mjs')).href);
 const {qualifySameBrowser}=await import(pathToFileURL(join(ROOT,BASE+'same-browser-qualify.mjs')).href),{observeRetentionRace}=await import(pathToFileURL(join(ROOT,BASE+'same-browser-retention-races.draft.mjs')).href);
 const {observeLegacyPruneRace}=await import(pathToFileURL(join(ROOT,BASE+'legacy-prune-race.draft.mjs')).href);
 const {observePersistentFreeze}=await import(pathToFileURL(join(ROOT,BASE+'persistent-freeze-race.draft.mjs')).href);
 const {observeFreezeOrder}=await import(pathToFileURL(join(ROOT,BASE+'persistent-freeze-orders.draft.mjs')).href);
 const {observeFullCutover}=await import(pathToFileURL(join(ROOT,BASE+'full-cutover-transaction.draft.mjs')).href);
 const {observeWithdrawalRace}=await import(pathToFileURL(join(ROOT,BASE+'withdrawal-v2-race.draft.mjs')).href);
 const {observeOrigin218Freeze}=await import(pathToFileURL(join(ROOT,BASE+'origin-218-freeze-exception.draft.mjs')).href);
 const {observeOrigin218Ledger}=await import(pathToFileURL(join(ROOT,BASE+'origin-218-full-ledger.draft.mjs')).href);
 const {observePendingOriginRace}=await import(pathToFileURL(join(ROOT,BASE+'pending-origin-race.draft.mjs')).href);
 const {observeLedgerVisibility}=await import(pathToFileURL(join(ROOT,BASE+'ledger-visibility-probe.draft.mjs')).href);
 const {observeRecoveryLedger}=await import(pathToFileURL(join(ROOT,BASE+'recovery-ledger-bound.draft.mjs')).href);
 const {runBoundedProcess}=await import(pathToFileURL(join(ROOT,'scripts/verification/auth-local-ci.mjs')).href);
 const qualified=qualifySources(bytes.get(BASE+'fixture.sql'),bytes.get(BASE+'reservation.sql.txt'),bytes.get('scripts/verification/front-b-signup-reservation-draft/candidate-reservation.sql.txt'));requireSqlBytes(qualified.fixture);requireSqlBytes(qualified.candidate);
 const sameBrowser=qualifySameBrowser({foundation:bytes.get(SAME_BROWSER_PINS[0][0]),composition:bytes.get(SAME_BROWSER_PINS[1][0]),fixture:bytes.get(BASE+'same-browser-fixture.sql'),seed:bytes.get(BASE+'same-browser-seed.sql')});for(const sql of Object.values(sameBrowser))requireSqlBytes(sql);
 let home,groupKnown=true;const pending=new Set();
 const run=async(args,timeout=30000,options={})=>{const promise=runBoundedProcess('docker',args,{cwd:ROOT,env:os,timeoutMs:timeout,maxBytes:2097152,...options});pending.add(promise);try{const v=await promise;if(v.groupConfirmed!==true){groupKnown=false;fail();}return v;}catch(e){if(e?.groupConfirmed!==true)groupKnown=false;throw e;}finally{pending.delete(promise);}};
 const list=async filter=>(await run(['ps','--all','--no-trunc','--quiet','--filter',filter])).stdout.trim().split(/\r?\n/).filter(Boolean);
 const inspect=async id=>json((await run(['inspect','--format','{{json .}}',id])).stdout);
 let allClean=true;const results=[];
 try{
  home=await mkdtemp(join(env.RUNNER_TEMP,'sc-fb-race-'));if(await realpath(home)!==home)fail();os.HOME=home;os.DOCKER_CONFIG=join(home,'docker-config');
  await run(['pull','--platform','linux/amd64',IMAGE],300000,{capture:false});const image=requireImage(json((await run(['image','inspect','--format','{{json .}}',IMAGE])).stdout));
  for(const kind of ['reservation','start','renewal','fence','legacy','persistent-freeze','freeze-reverse','freeze-rollback','full-cutover','withdrawal-renew-first','withdrawal-withdraw-first','origin-218-freeze-commit','origin-218-freeze-rollback','origin-218-full-quarantine','origin-218-full-cutover','pending-origin-reserve-first','pending-origin-withdraw-reserve','pending-origin-finish-first','pending-origin-withdraw-finish','ledger-visibility-absent','ledger-visibility-visible','ledger-visibility-duplicate','recovery-ledger-bound']){
   process.stderr.write(JSON.stringify({stage:'case-start',kind})+'\n');
   const nonce=randomBytes(16).toString('hex'),name='sc-front-b-offline-'+nonce,label='sc.front-b-offline='+nonce;let id=null,created=false,ok=false;const sessions=[];
   const owned=async()=>{const a=await list('name=^/'+name+'$'),b=await list('label='+label);if(a.length>1||b.length>1||JSON.stringify(a)!==JSON.stringify(b)||a.some(x=>!ID.test(x)))fail();return a[0]??null;};
   try{
    if(await owned()!==null)fail();created=true;
    id=(await run(['create','--platform','linux/amd64','--name',name,'--label',label,'--network','none','--read-only','--tmpfs','/var/lib/postgresql/data:rw,nosuid,nodev,size=536870912','--tmpfs','/var/run/postgresql:rw,nosuid,nodev,size=16777216','--tmpfs','/tmp:rw,nosuid,nodev,size=16777216','--env','POSTGRES_HOST_AUTH_METHOD=trust',IMAGE],60000)).stdout.trim();
    if(!ID.test(id)||await owned()!==id)fail();requireOfflineContainer(await inspect(id),id,name,image,nonce,false);await run(['start',id],30000,{capture:false});requireOfflineContainer(await inspect(id),id,name,image,nonce);
    const psql=async sql=>(await run(['exec','--interactive','--user','postgres',id,'psql','--no-psqlrc','--no-password','--quiet','--tuples-only','--no-align','--set','ON_ERROR_STOP=1','--host','/var/run/postgresql','--username','postgres','--dbname','postgres','--file=-'],60000,{input:sql})).stdout;
    const probe="select json_build_object('database',current_database(),'owner',current_user,'version',current_setting('server_version_num')::integer,'systemIdentifier',(select system_identifier::text from pg_control_system()));";let instance;
    for(let i=0;i<60;i++){try{instance=json(await psql(probe));break;}catch(e){if(!groupKnown)throw e;await pause(1000);}}
    if(!instance||instance.database!=='postgres'||instance.owner!=='postgres'||!Number.isSafeInteger(instance.version)||instance.version<170000||instance.version>=180000||!/^\d{16,20}$/.test(instance.systemIdentifier))fail();const systemIdentifier=instance.systemIdentifier;
    await psql(`begin;do $boot$ begin if current_user<>'postgres' or current_database()<>'postgres' or current_setting('server_version_num')::integer<170000 or current_setting('server_version_num')::integer>=180000 or inet_server_addr() is not null or inet_client_addr() is not null or (select system_identifier::text from pg_control_system())<>'${systemIdentifier}' then raise exception 'REFUSED';end if;end $boot$;create schema sc_front_b_observation;revoke all on schema sc_front_b_observation from public;create table sc_front_b_observation.marker(nonce text primary key,system_identifier text not null);revoke all on sc_front_b_observation.marker from public;insert into sc_front_b_observation.marker values('${nonce}','${systemIdentifier}');commit;`);
    const checked=async sql=>psql(sameSessionGuard(nonce,systemIdentifier)+requireSqlBytes(Buffer.from(sql)).toString('utf8'));
    if(kind==='reservation'||kind==='start'){await checked(qualified.fixture.toString('utf8'));await checked(qualified.candidate.toString('utf8'));}
    else if(kind.startsWith('withdrawal-')){
      await checked(bytes.get(BASE+'withdrawal-v2.fixture.sql').toString('utf8'));
      const candidate=bytes.get(BASE+'withdrawal-v2.guarded.sql.txt').toString('utf8'),guard="DO $guard$ BEGIN RAISE EXCEPTION 'GUARDED: review cutover and exact database provenance'; END $guard$;";
      if(candidate.split(guard).length!==2)fail();await checked(candidate.replace(guard,''));
    } else if(!kind.startsWith('ledger-visibility-')) for(const sql of ['legacy','persistent-freeze','freeze-reverse','freeze-rollback','full-cutover'].includes(kind)?[sameBrowser.fixture,sameBrowser.foundation]:kind==='recovery-ledger-bound'?[sameBrowser.fixture,sameBrowser.foundation,sameBrowser.composition]:[sameBrowser.fixture,sameBrowser.foundation,sameBrowser.composition,sameBrowser.seed])await checked(sql.toString('utf8'));
    process.stderr.write(JSON.stringify({stage:'case-fixture-ready',kind})+'\n');
    const context={nonce,systemIdentifier,user:'10000000-0000-4000-8000-000000000001',session:'20000000-0000-4000-8000-000000000001',intent:'30000000-0000-4000-8000-000000000001',requestA:'40000000-0000-4000-8000-000000000001',requestB:'40000000-0000-4000-8000-000000000002'};
    if(kind==='reservation')for(const nullCase of ['intent_state','intent_expiry','admission_origin','admission_state','identity_null']){const result=json(await checked(nullCaseSql(context,nullCase)));if(result.kind!=='null-refused'||result.case!==nullCase||Object.keys(result).length!==2)fail();const baseline=json(await checked(nullBaselineSql(context)));if(baseline.kind!=='baseline'||baseline.intact!==true||Object.keys(baseline).length!==2)fail();}
    let generation=null;if(kind==='start'){const seed=json(await checked(seedStartSql(context)));if(seed.kind!=='seed'||seed.result?.status!=='acquired'||seed.result.requestId!==context.requestA||!/^[0-9a-f-]{36}$/i.test(seed.result.generation))fail();generation=seed.result.generation;}
    const ports={open:async()=>{const session=openDockerSession({id,cwd:ROOT,env:os,checkSql:requireSqlBytes,groupAbsent});sessions.push(session);return session;},query:async sql=>json(await checked(sql)),pause:()=>pause(100)};
    if(kind==='recovery-ledger-bound')results.push(await observeRecoveryLedger({exec:checked,query:async sql=>json(await checked(sql))},{nonce,systemIdentifier,user:context.user,session:context.session},{recovery:bytes.get(BASE+'recovery-ledger-bound.guarded.sql.txt'),install:bytes.get(BASE+'install-only.reviewable.sql.txt'),quarantine:bytes.get(BASE+'origin-218-quarantine.guarded.sql.txt'),cutover:bytes.get(BASE+'origin-218-full-cutover.guarded.sql.txt'),freeze:bytes.get(BASE+'persistent-freeze.quarantine.guarded.sql.txt'),candidate:bytes.get(BASE+'withdrawal-v2.guarded.sql.txt'),foundation:bytes.get(SAME_BROWSER_PINS[0][0])}));
    else if(kind.startsWith('ledger-visibility-'))results.push(await observeLedgerVisibility({exec:checked},bytes.get(BASE+'ledger-visibility-probe.fail.sql.txt'),kind.slice('ledger-visibility-'.length)));
    else if(kind.startsWith('withdrawal-')){
     const initial=json(await checked(`select json_build_object('kind','initial','result',public.signup_origin_status_v2('${context.user}'::uuid,'${context.session}'::uuid));`));
     if(initial?.kind!=='initial'||initial.result?.status!=='active'||!/^[0-9a-f-]{36}$/i.test(initial.result?.revision??''))fail();
     results.push(await observeWithdrawalRace(ports,{nonce,systemIdentifier,user:context.user,session:context.session},initial.result.revision,kind==='withdrawal-renew-first'?'renew-first':'withdraw-first'));
    } else if(kind.startsWith('pending-origin-'))results.push(await observePendingOriginRace({...ports,exec:checked},{nonce,systemIdentifier,user:context.user,session:context.session,intent:context.intent,request:context.requestA},{pending:bytes.get(BASE+'pending-origin-v2.guarded.sql.txt'),candidate:bytes.get(BASE+'withdrawal-v2.guarded.sql.txt'),freeze:bytes.get(BASE+'persistent-freeze.quarantine.guarded.sql.txt'),foundation:bytes.get(SAME_BROWSER_PINS[0][0])},kind.slice('pending-origin-'.length)));
    else if(kind.startsWith('origin-218-full-'))results.push(await observeOrigin218Ledger({exec:checked,query:async sql=>json(await checked(sql))},{nonce,systemIdentifier,user:context.user,session:context.session},{quarantine:bytes.get(BASE+'origin-218-quarantine.guarded.sql.txt'),cutover:bytes.get(BASE+'origin-218-full-cutover.guarded.sql.txt'),freeze:bytes.get(BASE+'persistent-freeze.quarantine.guarded.sql.txt'),candidate:bytes.get(BASE+'withdrawal-v2.guarded.sql.txt'),foundation:bytes.get(SAME_BROWSER_PINS[0][0])},kind==='origin-218-full-quarantine'?'quarantine':'cutover'));
    else if(kind.startsWith('origin-218-freeze-'))results.push(await observeOrigin218Freeze(ports,{nonce,systemIdentifier,user:context.user,session:context.session},bytes.get(BASE+'persistent-freeze.quarantine.guarded.sql.txt'),bytes.get(BASE+'withdrawal-v2.guarded.sql.txt'),kind==='origin-218-freeze-commit'?'commit':'rollback',bytes.get(SAME_BROWSER_PINS[0][0])));
    else if(kind==='full-cutover')results.push(await observeFullCutover({exec:checked,query:async sql=>json(await checked(sql))},{foundation:bytes.get(SAME_BROWSER_PINS[0][0]),quarantine:bytes.get(BASE+'persistent-freeze.quarantine.guarded.sql.txt'),cutover:bytes.get(BASE+'persistent-freeze.cutover.guarded.sql.txt'),preflight:bytes.get(BASE+'ledger-preflight.readonly.sql.txt')}));
    else if(kind==='freeze-reverse'||kind==='freeze-rollback')results.push(await observeFreezeOrder(ports,{nonce,systemIdentifier},sameBrowser.composition.toString('utf8'),bytes.get(BASE+'persistent-freeze.quarantine.guarded.sql.txt'),kind==='freeze-reverse'?'reverse':'rollback'));
    else if(kind==='persistent-freeze')results.push(await observePersistentFreeze(ports,{nonce,systemIdentifier},sameBrowser.composition.toString('utf8'),bytes.get(BASE+'persistent-freeze.quarantine.guarded.sql.txt')));
    else if(kind==='legacy')results.push(await observeLegacyPruneRace(ports,{nonce,systemIdentifier},sameBrowser.composition.toString('utf8')));
    else if(kind==='renewal'||kind==='fence')results.push(await observeRetentionRace(ports,{nonce,systemIdentifier,user:context.user,session:context.session,intent:context.intent,request:context.requestA},kind));
    else results.push(await observeReservationRace(ports,context,generation));
    process.stderr.write(JSON.stringify({stage:'case-observed',kind})+'\n');requireOfflineContainer(await inspect(id),id,name,image,nonce);ok=true;
   }finally{
    const cleanupAllowed=mayTeardown(groupKnown,pending.size,sessions.map(s=>s.state()));if(!cleanupAllowed)allClean=false;
    if(cleanupAllowed)try{const found=await owned();if(id&&found!==id)fail();if(!id)id=found;if(id){const state=await inspect(id);requireOfflineContainer(state,id,name,image,nonce,state.State?.Running);await run(['rm','--force','--volumes',id],60000,{capture:false});}if(await owned()!==null||id&&(await list('id='+id)).length!==0||created&&!id)fail();await run(['info','--format','{{json .ID}}']);}catch{allClean=false;}
   }
   if(!ok||!allClean)fail();
  }
 }finally{if(home&&groupKnown&&pending.size===0&&allClean)try{await removeEmptyOwnedDirectory(env.RUNNER_TEMP,home);}catch{allClean=false;}}
 if(!allClean||!groupKnown||pending.size||git(['rev-parse','HEAD']).toString().trim()!==env.GITHUB_SHA||git(['status','--porcelain','--untracked-files=all']).toString().trim())fail();
 for(const [path,previous] of bytes){const current=await source(path);if(!current.equals(previous)||!current.equals(git(['show','HEAD:'+path])))fail();}
 return receipt(env.GITHUB_SHA,results,groupKnown,pending.size,allClean);
}
export async function main(argv=process.argv.slice(2),env=process.env,output=x=>process.stdout.write(JSON.stringify(x)+'\n')){if(!argv.length||argv.length===1&&argv[0]==='--help'){output({code:'NO_SERVICE_STARTED',acceptance:false});return 0;}if(argv.length!==1||argv[0]!=='--execute'){output({code:'RACE_RUNNER_REFUSED',acceptance:false});return 1;}try{output(await execute(env));return 0;}catch{output({code:'RACE_RUNNER_REFUSED',acceptance:false});return 1;}}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)process.exitCode=await main();
