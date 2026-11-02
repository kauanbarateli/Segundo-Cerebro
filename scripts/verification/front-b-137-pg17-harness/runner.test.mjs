import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,existsSync } from 'node:fs';
import { mkdtemp,realpath,writeFile,unlink,rmdir,lstat } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { tmpdir } from 'node:os';
import { BOOTSTRAP_PATHS,checkEnvironment,checkIntegratedPath,checkBootstrapSources,checkReadonlyContainer,cleanupTemporaryHome,main } from './runner.mjs';
const valid={PATH:'/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',CI:'true',GITHUB_ACTIONS:'true',RUNNER_TEMP:'/tmp/runner',GITHUB_SHA:'a'.repeat(40),GITHUB_REF:'refs/heads/codex/front-b-137-pg17-observation',GITHUB_EVENT_NAME:'push',SC_METRICS_PG17_RUN:'1'};
test('environment requires explicit CI, allowed branch, SHA, opt-in and no unexpected variables',()=>{
 assert.doesNotThrow(()=>checkEnvironment(valid,'linux'));
 for(const bad of [{...valid,API_TOKEN:'secret'},{...valid,GITHUB_REF:'refs/heads/main'},{...valid,GITHUB_EVENT_NAME:'workflow_dispatch'},{...valid,SC_METRICS_PG17_RUN:'0'},{...valid,GITHUB_SHA:'main'},{...valid,RUNNER_TEMP:'relative'},{...valid,CI:'false'},{...valid,PATH:''}])assert.throws(()=>checkEnvironment(bad,'linux'),/SYNTHETIC_OBSERVATION_REFUSED/);
 assert.throws(()=>checkEnvironment(valid,'win32'),/SYNTHETIC_OBSERVATION_REFUSED/);
});
test('scratch and malformed process closure are refused',()=>{
 assert.doesNotThrow(()=>checkIntegratedPath('scripts/verification/front-b-137-pg17-harness/runner.mjs'));
 for(const path of ['work/front-b-137-pg17-harness/runner.mjs','scripts/verification/../front-b-137-pg17-harness/runner.mjs'])assert.throws(()=>checkIntegratedPath(path));
 assert.throws(()=>checkBootstrapSources(new Map()));
});
test('current reviewed helper closure passes, and a changed byte is refused',()=>{
 const root=existsSync('scripts/verification/auth-local-ci.mjs')?'.':'work/Segundo-Cerebro';
 const files=new Map(BOOTSTRAP_PATHS.map(p=>[p,readFileSync(resolve(root,p))]));
 assert.doesNotThrow(()=>checkBootstrapSources(files));
 const path=BOOTSTRAP_PATHS[0],changed=Buffer.from(files.get(path));changed[0]^=1;files.set(path,changed);
 assert.throws(()=>checkBootstrapSources(files),/SYNTHETIC_OBSERVATION_REFUSED/);
});
test('container requires read-only root, disabled network and no privileged flag',()=>{
 const state={HostConfig:{ReadonlyRootfs:true,NetworkMode:'none',Privileged:false}};assert.doesNotThrow(()=>checkReadonlyContainer(state));
 for(const state of [{HostConfig:{ReadonlyRootfs:false,NetworkMode:'none',Privileged:false}},{HostConfig:{ReadonlyRootfs:true,NetworkMode:'host',Privileged:false}},{HostConfig:{ReadonlyRootfs:true,NetworkMode:'none',Privileged:true}},{}])assert.throws(()=>checkReadonlyContainer(state));
});
test('temporary HOME cleanup removes only its own empty directory',async()=>{
 const parent=await realpath(await mkdtemp(join(tmpdir(),'sc-test-'))),home=await mkdtemp(join(parent,'sc-metrics-'));
 try{
  await writeFile(join(home,'canary'),'keep');
  await assert.rejects(()=>cleanupTemporaryHome(home,parent));
  assert((await lstat(join(home,'canary'))).isFile());
  await assert.rejects(()=>cleanupTemporaryHome(home,dirnameForTest(parent)));
  await unlink(join(home,'canary'));await cleanupTemporaryHome(home,parent);
  await assert.rejects(()=>lstat(home),e=>e.code==='ENOENT');
 }finally{await rmdir(parent);}
});
function dirnameForTest(parent){return join(parent,'different');}
test('default and invalid invocation never initiate a service',async()=>{
 const output=[];assert.equal(await main([],{},v=>output.push(v)),0);assert.deepEqual(output,[{code:'NO_SERVICE_STARTED',acceptance:false}]);
 assert.equal(await main(['--invalid'],{},()=>{}),1);
 // Deliberately invalid opt-in guarantees refusal before any subprocess in CI too.
 assert.equal(await main(['--execute'],{...valid,SC_METRICS_PG17_RUN:'0'},()=>{}),1);
});
