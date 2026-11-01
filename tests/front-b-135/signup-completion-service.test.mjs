// Adaptação provisória dos modelos sintéticos; os tipos da produção permanecem verificados.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { completePublicSignup } from '../../src/lib/auth/signup-completion-service';
const userId='10000000-0000-4000-8000-000000000001',sessionId='20000000-0000-4000-8000-000000000001',intentId='30000000-0000-4000-8000-000000000001',generation='40000000-0000-4000-8000-000000000001';
const checkpoint={userId,sessionId,intentId,issuedAt:1000,expiresAt:601000,passwordConfirmed:false,originPending:true};
const identity={userId,sessionId,email:'pessoa@example.invalid'},legal={terms:'v1',privacy:'v2'};
const input={password:'senha sintética longa',acceptedLegal:true,termsVersion:'v1',privacyVersion:'v2',acceptedOrigin:true};
const gate=()=>{let resolve;return {promise:new Promise(r=>{resolve=r;}),resolve};};
function fixture({provider=async()=> 'updated',enabled=true,markFail=false,ackFail=false,finishFail=false}={}){
 let state='empty',owner=null,authCalls=0,request=0,reservationInput=null,identityCalls=0,withdrawn=false,finishVersions=null,originRecorded=false;
 const ports={
  reservationEnabled:()=>enabled,now:()=>2000,readCheckpoint:()=>checkpoint,readVerifiedIdentity:async()=>{identityCalls++;return identity;},subjectHash:()=> 'a'.repeat(64),limit:async()=>({allowed:true}),
  findBoundIntent:async()=>({intentId,termsVersion:'v1',privacyVersion:'v2',state:'bound',originPending:true}),
  newRequestId:()=>`50000000-0000-4000-8000-${String(++request).padStart(12,'0')}`,
  async reserveCompletion(value){if(state!=='empty')return {status:'pending'};state='reserved';owner=value.requestId;reservationInput=value;return {status:'acquired',requestId:owner,generation};},
  async startCompletion(f){if(state!=='reserved'||f.requestId!==owner||f.generation!==generation)return false;state='auth_in_flight';return true;},
  async updatePassword(){authCalls++;return provider();},
  async markUncertain(){if(markFail)throw Error('lost');if(state==='auth_in_flight')state='uncertain';},
  async acknowledgePassword(){if(ackFail)throw Error('lost');if(state!=='auth_in_flight')return false;state='password_acknowledged';return true;},
  async finishCompletion(_fence,versions){finishVersions=versions;if(finishFail)throw Error('lost');if(state!=='password_acknowledged')return false;originRecorded=reservationInput.acceptOrigin&&!withdrawn;state='complete';return true;},
  async withdrawCurrent(u,s){if(u!==userId||s!==sessionId)return null;withdrawn=true;originRecorded=false;return {status:"withdrawn"};},
  async confirmFinished(u,s,i){return u===userId&&s===sessionId&&i===intentId&&state==='complete';},async clearCheckpoint(){},
 };
 return{ports,get state(){return state;},get calls(){return authCalls;},get snapshot(){return reservationInput;},get identityCalls(){return identityCalls;},get withdrawn(){return withdrawn;},get finishVersions(){return finishVersions;},get originRecorded(){return originRecorded;}};
}

test('disabled runtime is closed before reading identities or calling Auth',async()=>{
 const f=fixture({enabled:false});assert.deepEqual(await completePublicSignup(f.ports,input,legal),{status:'unavailable'});assert.equal(f.identityCalls,0);assert.equal(f.calls,0);
});
test('two concurrent requests with distinct passwords result in one Auth call',{timeout:5000},async()=>{
 const started=gate(),release=gate(),f=fixture({provider:async()=>{started.resolve();return release.promise;}});
 const first=completePublicSignup(f.ports,input,legal);await started.promise;
 assert.deepEqual(await completePublicSignup(f.ports,{...input,password:'outra senha sintética longa'},legal),{status:'pending-reconciliation'});
 release.resolve('unknown');assert.deepEqual(await first,{status:'pending-reconciliation'});
 assert.deepEqual(await completePublicSignup(f.ports,input,legal),{status:'pending-reconciliation'});assert.equal(f.calls,1);assert.equal(f.state,'uncertain');
});
test('same request ID and replay are blocked by durable reservation contract',{timeout:5000},async()=>{
 const started=gate(),release=gate(),f=fixture({provider:async()=>{started.resolve();return release.promise;}});f.ports.newRequestId=()=> '50000000-0000-4000-8000-000000000001';
 const first=completePublicSignup(f.ports,input,legal);await started.promise;assert.equal((await completePublicSignup(f.ports,input,legal)).status,'pending-reconciliation');
 release.resolve('updated');assert.equal((await first).status,'completed');assert.equal(f.calls,1);
});
test('lost start response after commit does not call Auth or authorize replay',async()=>{
 const f=fixture(),start=f.ports.startCompletion;f.ports.startCompletion=async fence=>{await start(fence);throw Error('response lost');};
 assert.equal((await completePublicSignup(f.ports,input,legal)).status,'pending-reconciliation');assert.equal(f.state,'auth_in_flight');
 assert.equal((await completePublicSignup(f.ports,input,legal)).status,'pending-reconciliation');assert.equal(f.calls,0);
});
test('lost reserve response after commit leaves an exclusive reservation',async()=>{
 const f=fixture(),reserve=f.ports.reserveCompletion;f.ports.reserveCompletion=async value=>{await reserve(value);throw Error('response lost');};
 assert.equal((await completePublicSignup(f.ports,input,legal)).status,'pending-reconciliation');assert.equal(f.state,'reserved');
 assert.equal((await completePublicSignup(f.ports,input,legal)).status,'pending-reconciliation');assert.equal(f.calls,0);
});
test('malformed or mismatched reservation and non-boolean start never call Auth',async()=>{
 for(const reserve of [async()=>({status:'acquired',requestId:'bad',generation}),async()=>({status:'acquired',requestId:'50000000-0000-4000-8000-000000000001',generation,extra:true})]){
  const f=fixture();f.ports.reserveCompletion=reserve;assert.equal((await completePublicSignup(f.ports,input,legal)).status,'pending-reconciliation');assert.equal(f.calls,0);
 }
 const f=fixture();f.ports.startCompletion=async()=> 'true';assert.equal((await completePublicSignup(f.ports,input,legal)).status,'pending-reconciliation');assert.equal(f.calls,0);
});
test('rejected, unknown, timeout and failed uncertainty recording never reopen Auth',async()=>{
 for(const provider of [async()=> 'rejected',async()=> 'unknown',async()=>{throw Error('timeout');}]){
  const f=fixture({provider,markFail:true});assert.equal((await completePublicSignup(f.ports,input,legal)).status,'pending-reconciliation');
  assert.equal(f.state,'auth_in_flight');assert.equal((await completePublicSignup(f.ports,input,legal)).status,'pending-reconciliation');assert.equal(f.calls,1);
 }
});
test('ack or finish failure cannot repeat a password update',async()=>{
 for(const option of [{ackFail:true},{finishFail:true}]){
  const f=fixture(option);assert.equal((await completePublicSignup(f.ports,input,legal)).status,'pending-reconciliation');
  assert.equal((await completePublicSignup(f.ports,input,legal)).status,'pending-reconciliation');assert.equal(f.calls,1);
 }
});
test('lost ack or finish response after commit never triggers another Auth call',async()=>{
 for(const name of ['acknowledgePassword','finishCompletion']){
  const f=fixture(),original=f.ports[name];f.ports[name]=async fence=>{await original(fence);throw Error('response lost');};
  assert.equal((await completePublicSignup(f.ports,input,legal)).status,'pending-reconciliation');
  assert.equal((await completePublicSignup(f.ports,input,legal)).status,name==='finishCompletion'?'completed':'pending-reconciliation');assert.equal(f.calls,1);
 }
});
test('session rotation after external success stays pending and never retries Auth',async()=>{
 const f=fixture(),read=f.ports.readVerifiedIdentity;let calls=0;f.ports.readVerifiedIdentity=async()=>++calls===1?read():{...identity,sessionId:'20000000-0000-4000-8000-000000000002'};
 assert.equal((await completePublicSignup(f.ports,input,legal)).status,'pending-reconciliation');assert.equal(f.state,'uncertain');assert.equal(f.calls,1);
});
test('moderation after start may precede the external effect but prevents admission in model',async()=>{
 let blocked=false;const f=fixture({provider:async()=>{blocked=true;return 'updated';}}),read=f.ports.readVerifiedIdentity;
 f.ports.readVerifiedIdentity=async()=>blocked?null:read();
 assert.equal((await completePublicSignup(f.ports,input,legal)).status,'pending-reconciliation');assert.equal(f.calls,1);assert.equal(f.state,'uncertain');
});
test('identity remains valid while moderation makes the finish port refuse admission',async()=>{
 let blocked=false;const f=fixture({provider:async()=>{blocked=true;return 'updated';}}),finish=f.ports.finishCompletion;
 f.ports.finishCompletion=async fence=>blocked?false:finish(fence);
 assert.equal((await completePublicSignup(f.ports,input,legal)).status,'pending-reconciliation');
 assert.equal(f.identityCalls,2);assert.equal(f.state,'password_acknowledged');assert.equal(f.calls,1);
 assert.equal((await completePublicSignup(f.ports,input,legal)).status,'pending-reconciliation');assert.equal(f.calls,1);
});
test('unresolved provider promise keeps first call pending and the fence blocks another', {timeout:5000},async()=>{
 const started=gate(),release=gate(),f=fixture({provider:async()=>{started.resolve();return release.promise;}});
 const first=completePublicSignup(f.ports,input,legal);await started.promise;let settled=false;void first.then(()=>{settled=true;});
 await Promise.resolve();assert.equal(settled,false);assert.equal(f.state,'auth_in_flight');
 assert.equal((await completePublicSignup(f.ports,input,legal)).status,'pending-reconciliation');assert.equal(f.calls,1);
 release.resolve('updated');assert.equal((await first).status,'completed');assert.equal(f.calls,1);
});
test('old password-confirmed cookie never authorizes a second update',async()=>{
 const f=fixture();f.ports.readCheckpoint=()=>({...checkpoint,passwordConfirmed:true});
 assert.equal((await completePublicSignup(f.ports,input,legal)).status,'pending-reconciliation');assert.equal(f.state,'empty');assert.equal(f.calls,0);
});
test('reservation receives immutable legal/origin choice, not a pre-lock discard',async()=>{
 const f=fixture();assert.equal((await completePublicSignup(f.ports,{...input,acceptedOrigin:false},legal)).status,'completed');
 assert.equal(f.snapshot.acceptOrigin,false);assert.equal(f.snapshot.originVersion,null);assert.equal(f.snapshot.terms,'v1');assert.equal(f.snapshot.privacy,'v2');
 assert.equal(Object.hasOwn(f.snapshot,'password'),false);assert.equal(f.withdrawn,true);
 assert.deepEqual(f.finishVersions,{terms:'v1',privacy:'v2',originVersion:'signup-origin-v1'});
});
test('consumed intent requires durable confirmation, not the former complete RPC',async()=>{
 const f=fixture();f.ports.findBoundIntent=async()=>({intentId,termsVersion:'v1',privacyVersion:'v2',state:'consumed',originPending:false});
 assert.equal((await completePublicSignup(f.ports,input,legal)).status,'pending-reconciliation');f.ports.confirmFinished=async()=>true;
 assert.equal((await completePublicSignup(f.ports,input,legal)).status,'completed');assert.equal(f.calls,0);
});
test('competing explicit refusal while Auth runs is applied before loser reports pending',{timeout:5000},async()=>{
 const started=gate(),release=gate(),f=fixture({provider:async()=>{started.resolve();return release.promise;}});
 const winner=completePublicSignup(f.ports,input,legal);await started.promise;
 assert.equal((await completePublicSignup(f.ports,{...input,acceptedOrigin:false},legal)).status,'pending-reconciliation');
 assert.equal(f.withdrawn,true);release.resolve('updated');assert.equal((await winner).status,'completed');
 assert.equal(f.originRecorded,false);assert.equal(f.calls,1);
});
test('explicit refusal after committed finish removes the origin before confirming completion',async()=>{
 const f=fixture();assert.equal((await completePublicSignup(f.ports,input,legal)).status,'completed');assert.equal(f.originRecorded,true);
 assert.equal((await completePublicSignup(f.ports,{...input,acceptedOrigin:false},legal)).status,'completed');
 assert.equal(f.withdrawn,true);assert.equal(f.originRecorded,false);assert.equal(f.calls,1);
});
test('uncertain withdrawal or completion read cannot authorize Auth',async()=>{
 const a=fixture();a.ports.withdrawCurrent=async()=>{throw Error('unknown');};
 assert.equal((await completePublicSignup(a.ports,{...input,acceptedOrigin:false},legal)).status,'pending-reconciliation');assert.equal(a.calls,0);assert.equal(a.state,'empty');
 const b=fixture();b.ports.confirmFinished=async()=>{throw Error('unknown');};
 assert.equal((await completePublicSignup(b.ports,input,legal)).status,'pending-reconciliation');assert.equal(b.calls,0);assert.equal(b.state,'empty');
});
test('explicit refusal is processed before invalid password, legal version or old checkpoint',async()=>{
 for(const reason of ['password','legal','checkpoint']){
  const started=gate(),release=gate(),f=fixture({provider:async()=>{started.resolve();return release.promise;}});
  const winner=completePublicSignup(f.ports,input,legal);await started.promise;
  const attempt={...input,acceptedOrigin:false,...(reason==='password'?{password:'short'}:{}),...(reason==='legal'?{termsVersion:'old'}:{})};
  if(reason==='checkpoint')f.ports.readCheckpoint=()=>({...checkpoint,passwordConfirmed:true});
  const result=await completePublicSignup(f.ports,attempt,legal);
  assert.equal(result.status,reason==='password'?'password-invalid':reason==='legal'?'invalid':'pending-reconciliation');
  assert.equal(f.withdrawn,true);release.resolve('updated');assert.equal((await winner).status,'completed');assert.equal(f.originRecorded,false);assert.equal(f.calls,1);
 }
});

test('withdrawal precedes confirmation, even when finish occurs between confirmation and intent read',async()=>{
 const f=fixture();const order=[];const withdrawal=f.ports.withdrawCurrent;
 f.ports.withdrawCurrent=async(...args)=>{order.push('withdraw');return withdrawal(...args);};
 f.ports.confirmFinished=async()=>{order.push('confirm');return false;};
 f.ports.findBoundIntent=async()=>{order.push('find-consumed');return {intentId,termsVersion:'v1',privacyVersion:'v2',state:'consumed',originPending:false};};
 assert.equal((await completePublicSignup(f.ports,{...input,acceptedOrigin:false},legal)).status,'pending-reconciliation');
 assert.deepEqual(order,['withdraw','confirm','find-consumed']);assert.equal(f.withdrawn,true);assert.equal(f.calls,0);
});
test('withdrawal runs before rate limiting and hash failure',async()=>{
 for(const stage of ['limit','hash']){const f=fixture();if(stage==='limit')f.ports.limit=async()=>({allowed:false});else f.ports.subjectHash=()=> 'invalid';
 assert.equal((await completePublicSignup(f.ports,{...input,acceptedOrigin:false},legal)).status,stage==='limit'?'rate-limited':'unavailable');assert.equal(f.withdrawn,true);assert.equal(f.calls,0);}
});
