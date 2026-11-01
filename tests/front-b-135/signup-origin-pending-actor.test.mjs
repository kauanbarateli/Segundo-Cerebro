import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readVerifiedActor } from '../../src/lib/auth/signup-origin-pending-actor';
const id='10000000-0000-4000-8000-000000000001',session='20000000-0000-4000-8000-000000000001';
const client=()=>({getUser:async()=>({data:{user:{id,email_confirmed_at:'2026-01-01'}},error:null}),getClaims:async()=>({data:{claims:{sub:id,session_id:session}},error:null})});
test('only the authenticated user and matching verified claims yield actor',async()=>{assert.deepEqual(await readVerifiedActor(client()),{userId:id,sessionId:session});});
test('anonymous, unconfirmed, missing and mismatched identities fail closed',async()=>{for(const user of [null,{id,is_anonymous:true,email_confirmed_at:'x'},{id,email_confirmed_at:null}]){const c=client();c.getUser=async()=>({data:{user},error:null});assert.equal(await readVerifiedActor(c),null);}for(const claims of [{sub:'other',session_id:session},{sub:id,session_id:'bad'},null]){const c=client();c.getClaims=async()=>({data:claims?{claims}:null,error:null});assert.equal(await readVerifiedActor(c),null);}});
test('provider failure is unknown rather than falsely claiming unauthenticated',async()=>{for(const method of ['getUser','getClaims']){const c=client();c[method]=async()=>{throw Error('private provider error');};await assert.rejects(()=>readVerifiedActor(c),{message:'IDENTITY_UNAVAILABLE'});}});
