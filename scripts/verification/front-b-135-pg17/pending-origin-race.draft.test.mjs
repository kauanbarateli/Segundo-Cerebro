import { test } from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {pendingOriginPlan,observePendingOriginRace} from './pending-origin-race.draft.mjs';import {requireSqlBytes} from './offline-contract.mjs';
const read=p=>readFileSync(new URL(p,import.meta.url));
const inputs={pending:read('./pending-origin-v2.guarded.sql.txt'),candidate:read('./withdrawal-v2.guarded.sql.txt'),freeze:read('./persistent-freeze.quarantine.guarded.sql.txt'),foundation:read('../front-b-135-draft/admission-feedback-metrics-atomic.sql.txt')};
const ctx={nonce:'1'.repeat(32),systemIdentifier:'1234567890123456',user:'10000000-0000-4000-8000-000000000001',session:'20000000-0000-4000-8000-000000000001',intent:'30000000-0000-4000-8000-000000000001',request:'40000000-0000-4000-8000-000000000001'},rev='50000000-0000-4000-8000-000000000001',gen='60000000-0000-4000-8000-000000000001';
test('only pinned bodies and valid identifiers yield an isolated plan',()=>{
 const p=pendingOriginPlan(ctx,inputs,'finish-first');for(const sql of [p.setup,p.initial,p.prep(rev),p.proof(gen),p.first(rev,gen),p.second(rev,gen),p.wait(100,200),p.final(rev)])assert.ok(requireSqlBytes(Buffer.from(sql)));
 assert.match(p.setup,/CREATE FUNCTION app_private.draft_finish_fenced/);assert.match(p.setup,/signup_fence_reserve_origin_v2/);assert.match(p.setup,/signup_origin_withdraw_v2/);assert.match(p.wait(100,200),/pg_blocking_pids\(200\)/);
 for(const sql of [p.first(rev,gen),p.second(rev,gen)]){
  assert.ok(sql.startsWith('begin;'));assert.match(sql,/OFFLINE_INSTANCE_REFUSED/);assert.match(sql,/pg_control_system/);assert.match(sql,/inet_server_addr\(\) is not null/);assert.match(sql,/server_version_num/);
  assert.ok(sql.includes(ctx.nonce));assert.ok(sql.includes(ctx.systemIdentifier));assert.ok(sql.indexOf('OFFLINE_INSTANCE_REFUSED')<sql.indexOf('set local role service_role'));
 }
 for(const name of Object.keys(inputs))assert.throws(()=>pendingOriginPlan(ctx,{...inputs,[name]:Buffer.concat([inputs[name],Buffer.from(' ')])},'finish-first'));
 for(const change of [{nonce:'bad'},{systemIdentifier:'not-a-system-id'}])assert.throws(()=>pendingOriginPlan({...ctx,...change},inputs,'finish-first'));
 for(const f of [()=>p.prep("bad'"),()=>p.proof("bad'"),()=>p.final("bad'"),()=>p.wait(100,100)])assert.throws(f);
});
const scenarios={
 'reserve-first':[{status:'acquired'}, {status:'withdrawn'},[true,false,false,false,false,true,true,false]],
 'withdraw-reserve':[{status:'withdrawn'}, {status:'stale'},[true,false,false,false,false,false,false,false]],
 'finish-first':[true,{status:'stale'},[false,true,false,true,true,true,false,true]],
 'withdraw-finish':[{status:'withdrawn'},true,[false,true,false,false,false,true,true,true]],
};
for(const [kind,[first,second,values]] of Object.entries(scenarios))test(`requires two bound backends and exact final state: ${kind}`,async()=>{
 const states=[{kind:'first-pid',pid:101},{kind:'first-result',result:first},{kind:'committed',pid:101}],other=[{kind:'second-pid',pid:202},{kind:'second-result',result:second},{kind:'committed',pid:202}],queues=[states,other];let n=0;
 const keys=['bound','consumed','intentOrigin','origin','newRevision','fence','withdrawn','complete'],trace=[];
 const ports={async open(){const q=queues[n++];return {async send(s){trace.push(s);},async read(){return q.shift();},async close(){return true;}};},async exec(s){trace.push(s);},async pause(){},async query(s){trace.push(s);if(s.includes("'kind','initial'"))return {kind:'initial',result:{status:'active',revision:rev}};if(s.includes("'kind','reserved'"))return {kind:'reserved',result:{status:'acquired',generation:gen}};if(s.includes("'kind','wait'"))return {kind:'wait',blocked:true,firstBound:true,secondBound:true};return {kind:'final',...Object.fromEntries(keys.map((k,i)=>[k,values[i]]))};}};
 const r=await observePendingOriginRace(ports,ctx,inputs,kind);assert.equal(r.scenario,`pending-origin-${kind}-pg17`);assert.equal(r.acceptance,false);assert.equal(r.hostedCertified,false);assert.ok(trace.some(x=>x.includes('pg_blocking_pids')));
});
test('refuses an unobserved blocking edge or an unclosed session',async()=>{
 for(const mode of ['unblocked','unclosed']){
  const queues=[[{kind:'first-pid',pid:101},{kind:'first-result',result:{status:'acquired'}},{kind:'committed',pid:101}],[{kind:'second-pid',pid:202},{kind:'second-result',result:{status:'withdrawn'}},{kind:'committed',pid:202}]];let n=0;
  const ports={async open(){const q=queues[n++];return {async send(){},async read(){return q.shift();},async close(){return mode!=='unclosed';}};},async exec(){},async pause(){},async query(s){if(s.includes("'kind','initial'"))return {kind:'initial',result:{status:'active',revision:rev}};if(s.includes("'kind','wait'"))return {kind:'wait',blocked:mode!=='unblocked',firstBound:true,secondBound:true};return {kind:'final',bound:true,consumed:false,intentOrigin:false,origin:false,newRevision:false,fence:true,withdrawn:true,complete:false};}};
  await assert.rejects(observePendingOriginRace(ports,ctx,inputs,'reserve-first'),/PENDING_ORIGIN_RACE_REFUSED/);
 }
});
