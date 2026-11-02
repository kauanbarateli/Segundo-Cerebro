import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildScenario } from './scenario.mjs';
import { buildInvocation } from './invocation.mjs';

const candidateBytes=readFileSync(new URL('./candidate.sql.txt',import.meta.url));
const fixtureBytes=readFileSync(new URL('./fixture-and-tests.sql.txt',import.meta.url));
const good={nonce:'0123456789abcdef0123456789abcdef',systemIdentifier:'1234567890123456789',candidateBytes,fixtureBytes};
test('scenario is identity bound, rolls back and contains verified SQL only in memory',()=>{
 const before=Buffer.from(candidateBytes), sql=buildScenario(good);
 assert(candidateBytes.equals(before));
 assert(sql.startsWith('begin;\ndo $sc_guard$'));
 for(const check of ["current_database()<>'sc_metrics_fixture'",'inet_server_addr() is not null','inet_client_addr() is not null',good.nonce,good.systemIdentifier,'current_setting(\'server_version_num\')','to_regnamespace(\'auth\')','to_regclass(\'public.profiles\')']) assert(sql.includes(check));
 assert(sql.indexOf('SYNTHETIC_TARGET_REFUSED')<sql.indexOf('create schema auth;'));
 assert.equal(sql.split('create function public.signup_metrics(').length,2);
 assert(sql.endsWith("\nrollback;\nselect 'SC_METRICS_SYNTHETIC_OK';\n"));
 assert(!sql.includes('DRAFT_ONLY: nao autorizado para execucao'));
 assert(!sql.includes('\\'));
});
test('rejects tampered bytes, malformed identity, and extra input fields',()=>{
 const mutated=Buffer.from(candidateBytes);mutated[5]^=1;
 const changed=Buffer.from(fixtureBytes);changed[5]^=1;
 for(const input of [{...good,candidateBytes:mutated},{...good,fixtureBytes:changed},{...good,nonce:'x'.repeat(32)},{...good,systemIdentifier:'x'},{...good,other:true},{...good,candidateBytes:'sql'},{...good,fixtureBytes:null}])assert.throws(()=>buildScenario(input),/SYNTHETIC_SCENARIO_REFUSED/);
});
test('fixture spells out actual privilege and all five-dimension assertions',()=>{
 const sql=buildScenario(good);
 for(const value of ['set local role anon;','set local role authenticated;','set local role service_role;','SYNTHETIC_NONMASTER_BYPASS','SYNTHETIC_NULL_ACTOR_BYPASS','SYNTHETIC_NULL_SESSION_BYPASS','SYNTHETIC_SESSION_BYPASS','SYNTHETIC_MODERATION_BYPASS','SYNTHETIC_PAYLOAD_FAILURE','SYNTHETIC_ABSENCE_FAILURE','utm_source','utm_medium','utm_campaign','utm_term','utm_content']) assert(sql.includes(value));
 for(const value of ['SYNTHETIC_MISSING_VERSION_BYPASS','SYNTHETIC_MISSING_DISTRIBUTIONS_BYPASS','SYNTHETIC_NULL_DISTRIBUTIONS_BYPASS','SYNTHETIC_MISSING_DIMENSION_BYPASS','is distinct from','is not true']) assert(sql.includes(value));
});
test('invocation uses only an explicit container ID, Unix socket and fixed database',()=>{
 const id='a'.repeat(64), invocation=buildInvocation({...good,containerId:id});
 assert.equal(invocation.program,'docker');assert.deepEqual(invocation.args.slice(0,5),['exec','--interactive','--user','postgres',id]);
 assert(invocation.args.includes('/var/run/postgresql'));assert(invocation.args.includes('sc_metrics_fixture'));assert(invocation.args.includes('ON_ERROR_STOP=1'));
 assert.equal(invocation.expectedStdout,'SC_METRICS_SYNTHETIC_OK\n');
 for(const containerId of ['example.com','-x','a'.repeat(63),'A'.repeat(64)])assert.throws(()=>buildInvocation({...good,containerId}),/SYNTHETIC_INVOCATION_REFUSED/);
});
