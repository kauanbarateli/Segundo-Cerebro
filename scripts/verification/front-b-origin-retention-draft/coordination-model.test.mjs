import test from 'node:test';
import assert from 'node:assert/strict';

// State-machine sketch only: this is not SQL or evidence of Postgres locking.
function latch(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,release:resolve};}
class Mutex {
  tail=Promise.resolve();
  async withLock(fn){const previous=this.tail,gate=latch();this.tail=gate.promise;await previous;try{return await fn();}finally{gate.release();}}
}
function fixture(){
 const mutex=new Mutex();
 const data={intent:{expiresAt:10,origin:'synthetic campaign'},fence:null,authCalls:0};
 return {
  data,
  reserveAndStart(now,entered,release){return mutex.withLock(async()=>{
   if(entered)entered.release();if(release)await release.promise;
   if(!data.intent||data.intent.expiresAt<=now||data.fence)return false;
   data.fence={phase:'auth_in_flight',originExpired:false};data.authCalls++;return true;
  });},
  prune(now,entered,release){return mutex.withLock(async()=>{
   if(entered)entered.release();if(release)await release.promise;
   if(!data.intent||data.intent.expiresAt>now)return 'unchanged';
   if(data.fence){data.intent.origin=null;data.fence.originExpired=true;return 'scrubbed-retained';}
   data.intent=null;return 'removed';
  });},
  recover(){return mutex.withLock(async()=>{if(data.fence)return false;if(!data.intent)data.intent={expiresAt:30,origin:null};return true;});}
 };
}

test('reserve/start wins then expires: retain fence, scrub UTM, deny re-entry',async()=>{
 const f=fixture(),entered=latch(),release=latch();
 const reserve=f.reserveAndStart(9,entered,release);await entered.promise;
 const prune=f.prune(11);release.release();
 assert.equal(await reserve,true);assert.equal(await prune,'scrubbed-retained');
 assert.equal(f.data.intent.origin,null);assert.deepEqual(f.data.fence,{phase:'auth_in_flight',originExpired:true});
 assert.equal(await f.recover(),false);assert.equal(await f.reserveAndStart(11),false);
 assert.equal(await f.prune(12),'scrubbed-retained');assert.equal(f.data.authCalls,1);
});
test('prune wins before reserve: reserve rechecks absent intent and calls no Auth',async()=>{
 const f=fixture(),entered=latch(),release=latch();
 const prune=f.prune(11,entered,release);await entered.promise;
 const reserve=f.reserveAndStart(11);release.release();
 assert.equal(await prune,'removed');assert.equal(await reserve,false);
 assert.equal(f.data.intent,null);assert.equal(f.data.fence,null);assert.equal(f.data.authCalls,0);
});
test('expired UTM is absent after modeled recreation; verification is not modeled',async()=>{
 const f=fixture();assert.equal(await f.prune(11),'removed');assert.equal(await f.recover(),true);
 assert.equal(f.data.intent.origin,null);assert.equal(f.data.authCalls,0);
});
