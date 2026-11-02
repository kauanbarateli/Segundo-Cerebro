import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptReservationResult} from './sql-result-adapter.mjs';
import {candidateCompletion} from './candidate.mjs';
const request='10000000-0000-4000-8000-000000000001',generation='20000000-0000-4000-8000-000000000001';
test('the SQL-shaped acquired result passes through the adapter to the orchestration',async()=>{
 let calls=0;
 const ports={reserve:async id=>adaptReservationResult({status:'acquired',requestId:id,generation},id),markAuthStarting:async()=>true,updatePassword:async()=>{calls++;return 'unknown';},markUncertain:async()=>{}};
 assert.deepEqual(await candidateCompletion(ports,{requestId:request,password:'synthetic'}),{status:'pending-reconciliation'});
 assert.equal(calls,1);
});
test('pending maps to busy; malformed, mismatched and extra fields fail closed',()=>{
 assert.deepEqual(adaptReservationResult({status:'pending'},request),{status:'busy'});
 for(const value of [{status:'acquired',generation},{status:'acquired',requestId:request,generation,extra:true},{status:'acquired',requestId:generation,generation},{status:'pending',generation},null]) assert.throws(()=>adaptReservationResult(value,request));
});
