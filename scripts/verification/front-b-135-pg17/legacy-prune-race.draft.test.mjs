import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyPruneRacePlan,observeLegacyPruneRace} from './legacy-prune-race.draft.mjs';
const ctx={nonce:'a'.repeat(32),systemIdentifier:'1234567890123456'},composition='BEGIN;\nselect 1;\nCOMMIT;\n';
test('plan requires an offline identity and keeps the call before replacement',()=>{
 const p=legacyPruneRacePlan(ctx,composition);assert.match(p.second,/signup_prune\(\)/);assert.match(p.waiting(101,102),/pg_blocking_pids/);assert.match(p.cutover,/testOnlyNewBody/);assert.throws(()=>legacyPruneRacePlan({...ctx,nonce:'bad'},composition));assert.throws(()=>p.waiting(101,101));
});
test('observer requires a blocked call and different old and new results',async()=>{
 const old={expiredRemoved:0,consumedScrubbed:0,originsRemoved:0,fencedExamined:0,expiredOriginsCleared:0};let calls=0;
 const sessions=[{send:async()=>{},read:async()=>++calls===1?{kind:'first',pid:101}:{kind:'cutover-committed'},close:async()=>true},{send:async()=>{},read:(()=>{let i=0;return async()=>++i===1?{kind:'second-start',pid:102}:{kind:'old-return',result:old};})(),close:async()=>true}];
 const ports={open:async()=>sessions.shift(),pause:async()=>{},query:async sql=>sql.includes("'preflight'")?{kind:'preflight',empty:true}:sql.includes("'waiting'")?{kind:'waiting',blocked:true}:{kind:'fresh',result:{testOnlyNewBody:true}}};
 assert.equal((await observeLegacyPruneRace(ports,ctx,composition)).scenario,'legacy-prune-resumes-after-replacement-pg17');
});
