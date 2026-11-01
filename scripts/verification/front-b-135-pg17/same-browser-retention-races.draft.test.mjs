import test from 'node:test';
import assert from 'node:assert/strict';
import {observeRetentionRace,retentionRacePlan} from './same-browser-retention-races.draft.mjs';

const ctx=Object.freeze({nonce:'a'.repeat(32),systemIdentifier:'1234567890123456',
 user:'10000000-0000-4000-8000-000000000001',session:'20000000-0000-4000-8000-000000000001',
 intent:'30000000-0000-4000-8000-000000000001',request:'40000000-0000-4000-8000-000000000001'});
const gen='50000000-0000-4000-8000-000000000001';
const stats=(fenced=0,cleared=0)=>({expiredRemoved:0,fencedExamined:fenced,expiredOriginsCleared:cleared});
function ports(scenario,patch={}){
 const events=[],closed=[];let held=0;
 const first=scenario==='renewal'?{status:'renewed',originPending:false}:{status:'acquired',requestId:ctx.request,generation:gen};
 const a={send:async sql=>events.push(sql.startsWith('commit;')?'commit-a':'start-a'),read:async()=>events.at(-1)==='commit-a'?{kind:'committed',pid:101}:{kind:'first',pid:101,result:first},close:async()=>{closed.push('a');return true;}};
 let bReads=0;
 const b={send:async()=>events.push('start-b'),read:async()=>++bReads===1?{kind:'second',pid:patch.samePid?101:202,result:stats()}:{kind:'secondCommitted',pid:202},close:async()=>{closed.push('b');return true;}};
 return {events,closed,open:async name=>name==='a'?a:b,query:async sql=>{
  if(sql.includes("'preflight'")){events.push('preflight');return {kind:'preflight',eligible:true};}
  if(sql.includes("'held'")){events.push('held');held++;return {kind:'held',ownerActive:true,lockHeld:patch.noLock&&held===2?false:true};}
  if(sql.includes("'sweep'")){events.push('sweep');return {kind:'sweep',result:scenario==='fence'?stats(1,1):stats()};}
  if(sql.includes("'final'")){events.push('final');return {kind:'final',intentPreserved:true,fencePreserved:scenario==='fence',attemptPreserved:true};}
  throw Error('unknown SQL');
 }};
}
for(const scenario of ['renewal','fence'])test(`${scenario} plan insists on two sessions, held user lock and final sweep`,async()=>{
 const p=ports(scenario),result=await observeRetentionRace(p,ctx,scenario);
 assert.equal(result.status,'CASE_OBSERVED_CLEANUP_PENDING');assert.equal(result.acceptance,false);assert.equal(result.hostedCertified,false);
 assert.deepEqual(p.events,['preflight','start-a','held','start-b','held','commit-a','sweep','final']);assert.deepEqual(p.closed,['a','b']);
 const plan=retentionRacePlan(ctx,scenario);
 assert.match(plan.first,/OFFLINE_INSTANCE_REFUSED/);assert.match(plan.second,/signup_prune\(\)/);
 assert.match(plan.held(101),/pg_try_advisory_xact_lock/);
});
test('unverified overlap, identical sessions or unsafe identifiers fail closed',async()=>{
 for(const patch of [{samePid:true},{noLock:true}]){
  const p=ports('renewal',patch);await assert.rejects(observeRetentionRace(p,ctx,'renewal'),/RETENTION_RACE_REFUSED/);assert.deepEqual(p.closed,['a','b']);
 }
 assert.throws(()=>retentionRacePlan({...ctx,user:"';delete--"},'fence'),/RETENTION_RACE_REFUSED/);
 assert.throws(()=>retentionRacePlan(ctx,'other'),/RETENTION_RACE_REFUSED/);
 assert.throws(()=>retentionRacePlan(ctx,'fence').held(-1),/RETENTION_RACE_REFUSED/);
});
