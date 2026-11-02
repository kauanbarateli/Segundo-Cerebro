import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareMarker,inspectMarker,reconcile} from './reconciliation-domain.ts';
const clientId='10000000-0000-4000-8000-000000000001',feedbackId='90000000-0000-4000-8000-000000000001',owner='abcdefghijklmnop',other='qrstuvwxyzABCDEF';
const marker=()=>({version:1,clientId,ownerBinding:owner});
function store(){let raw=null;return {getItem:()=>raw,setItem:(_key,value)=>{raw=value;},removeItem:()=>{raw=null;},dump:()=>raw};}

test('only a marker snapshot is persisted and output keeps its exact identifier',()=>{
 const s=store(),input=marker(),set=s.setItem;
 s.setItem=(key,value)=>{set(key,value);input.clientId='10000000-0000-4000-8000-000000000002';};
 assert.deepEqual(prepareMarker(s,input),{status:'ready',clientId});
 assert.deepEqual(JSON.parse(s.dump()),marker());assert.equal(inspectMarker(s,owner).status,'pending');
});
test('partial storage failure blocks sending or replacement of an existing marker',()=>{
 let raw=null,reads=0;const s={getItem:()=>{if(++reads===2)throw Error('failed');return raw;},setItem:(_key,value)=>{raw=value;},removeItem:()=>{raw=null;}};
 assert.equal(prepareMarker(s,marker()).status,'blocked');assert.equal(prepareMarker(s,marker()).status,'blocked');
 assert.equal(inspectMarker(s,owner).status,'pending');
});
test('account switch cannot reconcile or remove the preceding owner marker',()=>{
 const s=store();prepareMarker(s,marker());assert.equal(inspectMarker(s,other).status,'different-owner');
 assert.equal(reconcile(s,other,{status:'cancelled',clientId}).status,'different-owner');assert.equal(inspectMarker(s,owner).status,'pending');
});
test('unknown, malformed, wrong client and unauthorized shape keep the marker',()=>{
 const s=store();prepareMarker(s,marker());
 for(const result of [null,{status:'unknown',clientId},{status:'submitted',clientId},{status:'cancelled',clientId:'other'},{status:'cancelled',clientId,extra:true}]){
  assert.equal(reconcile(s,owner,result).status,'unknown');assert.equal(inspectMarker(s,owner).status,'pending');
 }
});
test('only a correlated terminal cancellation or submitted receipt clears marker',()=>{
 for(const result of [{status:'cancelled',clientId},{status:'submitted',clientId,feedbackId}]){
  const s=store();prepareMarker(s,marker());assert.equal(reconcile(s,owner,result).status,result.status);assert.equal(inspectMarker(s,owner).status,'none');
 }
});
test('uncertain storage cleanup is explicit even after a terminal receipt',()=>{
 const s=store();prepareMarker(s,marker());s.removeItem=()=>{throw Error('denied');};
 assert.deepEqual(reconcile(s,owner,{status:'cancelled',clientId}),{status:'terminal-storage-uncertain',terminal:'cancelled'});assert.equal(inspectMarker(s,owner).status,'pending');
});
test('confirmed terminal status survives successful removal followed by a failed read-back',()=>{
 for(const terminal of ['submitted','cancelled']){
  const s=store();prepareMarker(s,marker());const get=s.getItem,remove=s.removeItem;let fail=false;
  s.removeItem=()=>{remove();fail=true;};s.getItem=()=>{if(fail)throw Error('read-back failed after removal');return get();};
  const envelope=terminal==='submitted'?{status:terminal,clientId,feedbackId}:{status:terminal,clientId};
  assert.deepEqual(reconcile(s,owner,envelope),{status:'terminal-storage-uncertain',terminal});
  assert.equal(s.dump(),null);
 }
});
