import test from 'node:test';
import assert from 'node:assert/strict';
import {candidateCompletion} from './candidate.mjs';

const requestA='10000000-0000-4000-8000-000000000001',requestB='10000000-0000-4000-8000-000000000002',generation='20000000-0000-4000-8000-000000000001';
const input=requestId=>({requestId,password:'synthetic-password'});
function fixture({provider=async()=> 'updated',persistAck=true,uncertainWrite=true,finish=true}={}){
 let state='empty',owner=null,calls=0;
 const owns=f=>f.requestId===owner&&f.generation===generation;
 const ports={
  async reserve(id){if(state!=='empty')return{status:'busy'};owner=id;state='reserved';return{status:'acquired',requestId:id,generation};},
  async markAuthStarting(f){if(!owns(f)||state!=='reserved')return false;state='auth_in_flight';return true;},
  async updatePassword(){calls++;return provider();},
  async markUncertain(f){if(!uncertainWrite)throw Error('database unavailable');if(owns(f)&&state==='auth_in_flight')state='uncertain';},
  async confirmIdentity(){return true;},
  async markPasswordAcknowledged(f){if(!persistAck)throw Error('database unavailable');if(!owns(f)||state!=='auth_in_flight')return false;state='password_acknowledged';return true;},
  async finishAdmission(f){if(!owns(f)||state!=='password_acknowledged')return false;if(!finish)throw Error('result unknown');state='complete';return true;},
 };
 return{ports,state:()=>state,calls:()=>calls};
}
test('concurrent and later retry never call Auth again after unknown outcome',{timeout:5000},async()=>{
 let start,release;const started=new Promise(resolve=>{start=resolve;}),result=new Promise(resolve=>{release=resolve;});
 const f=fixture({provider:async()=>{start();return result;}}),first=candidateCompletion(f.ports,input(requestA));
 await started;assert.equal(f.state(),'auth_in_flight');assert.deepEqual(await candidateCompletion(f.ports,input(requestB)),{status:'pending-reconciliation'});
 release('unknown');assert.deepEqual(await first,{status:'pending-reconciliation'});assert.equal(f.state(),'uncertain');
 for(const id of [requestA,requestB])assert.deepEqual(await candidateCompletion(f.ports,input(id)),{status:'pending-reconciliation'});
 assert.equal(f.calls(),1);
});
test('provider acknowledgement followed by database uncertainty retains the durable fence',async()=>{
 const f=fixture({persistAck:false,uncertainWrite:false});assert.deepEqual(await candidateCompletion(f.ports,input(requestA)),{status:'pending-reconciliation'});
 assert.equal(f.state(),'auth_in_flight');assert.deepEqual(await candidateCompletion(f.ports,input(requestB)),{status:'pending-reconciliation'});assert.equal(f.calls(),1);
});
test('thrown or rejected provider result is never automatically retried or unlocked',async()=>{
 for(const provider of [async()=>{throw Error('timeout');},async()=> 'rejected']){
  const f=fixture({provider});assert.deepEqual(await candidateCompletion(f.ports,input(requestA)),{status:'pending-reconciliation'});
  assert.equal(f.state(),'uncertain');assert.deepEqual(await candidateCompletion(f.ports,input(requestB)),{status:'pending-reconciliation'});assert.equal(f.calls(),1);
 }
});
test('a confirmed result completes once; a second request cannot call Auth',async()=>{
 const f=fixture();assert.deepEqual(await candidateCompletion(f.ports,input(requestA)),{status:'completed'});assert.equal(f.state(),'complete');
 assert.deepEqual(await candidateCompletion(f.ports,input(requestB)),{status:'pending-reconciliation'});assert.equal(f.calls(),1);
});
test('failed or malformed reservation prevents any Auth invocation',async()=>{
 for(const reserve of [async()=>{throw Error('database unavailable');},async()=>({status:'acquired',requestId:requestB,generation}),async()=>({status:'acquired',requestId:requestA,generation:'bad'})]){
  const f=fixture();f.ports.reserve=reserve;assert.deepEqual(await candidateCompletion(f.ports,input(requestA)),{status:'unavailable'});assert.equal(f.calls(),0);
 }
});
test('a lost response after marking the provider call in flight never starts Auth',async()=>{
 const f=fixture(),mark=f.ports.markAuthStarting;
 f.ports.markAuthStarting=async fence=>{await mark(fence);throw Error('response lost after commit');};
 assert.deepEqual(await candidateCompletion(f.ports,input(requestA)),{status:'unavailable'});
 assert.equal(f.state(),'auth_in_flight');
 assert.deepEqual(await candidateCompletion(f.ports,input(requestB)),{status:'pending-reconciliation'});
 assert.equal(f.calls(),0);
});
test('a lost response after completing admission does not start Auth again',async()=>{
 const f=fixture(),finish=f.ports.finishAdmission;
 f.ports.finishAdmission=async fence=>{await finish(fence);throw Error('response lost after commit');};
 assert.deepEqual(await candidateCompletion(f.ports,input(requestA)),{status:'pending-reconciliation'});
 assert.equal(f.state(),'complete');
 assert.deepEqual(await candidateCompletion(f.ports,input(requestB)),{status:'pending-reconciliation'});
 assert.equal(f.calls(),1);
});
test('moderation after starting can precede the external effect; admission remains pending',async()=>{
 const f=fixture();let moderated=false;
 const mark=f.ports.markAuthStarting;
 f.ports.markAuthStarting=async fence=>{const result=await mark(fence);moderated=true;return result;};
 f.ports.confirmIdentity=async()=>!moderated;
 assert.deepEqual(await candidateCompletion(f.ports,input(requestA)),{status:'pending-reconciliation'});
 assert.equal(f.calls(),1,'the external call was not prevented by the local model');
 assert.equal(f.state(),'uncertain');
 assert.deepEqual(await candidateCompletion(f.ports,input(requestB)),{status:'pending-reconciliation'});
 assert.equal(f.calls(),1);
});
