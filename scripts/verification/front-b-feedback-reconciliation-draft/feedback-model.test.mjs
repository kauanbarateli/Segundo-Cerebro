import test from 'node:test';
import assert from 'node:assert/strict';
import {FeedbackModel} from './feedback-model.mjs';
import {begin,inspect,acceptReceipt} from './client-model.mjs';
const id='10000000-0000-4000-8000-000000000001', bindingA='abcdefghijklmnop',bindingB='qrstuvwxyzABCDEF';
const deferred=()=>{let resolve;return {promise:new Promise(r=>{resolve=r;}),resolve};};
function storage(){const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),dump:()=>[...map.values()]};}

test('submit holds lock: status unknown, cancel waits, then observes exactly one submitted', {timeout:5000},async()=>{
 const db=new FeedbackModel(),entered=deferred(),release=deferred();
 const submit=db.submit('A',id,'suggestion','mensagem fictícia válida',{entered:entered.resolve,wait:()=>release.promise});
 await entered.promise;assert.equal(db.status('A',id).status,'unknown');
 let cancelEntered=false;const cancel=db.cancel('A',id,{entered:()=>{cancelEntered=true;}});
 await Promise.resolve();assert.equal(cancelEntered,false);release.resolve();
 const [receipt,result]=await Promise.all([submit,cancel]);assert.equal(receipt.status,'submitted');assert.deepEqual(result,receipt);assert.equal(db.count,1);
});
test('cancel wins before old submit obtains lock: late submit cannot insert',async()=>{
 const db=new FeedbackModel(),delay=deferred();
 const late=(async()=>{await delay.promise;return db.submit('A',id,'suggestion','mensagem fictícia válida');})();
 assert.equal((await db.cancel('A',id)).status,'cancelled');delay.resolve();
 assert.equal((await late).status,'cancelled');assert.equal(db.count,0);
});
test('rolled-back submit allows waiting barrier to cancel and retry remains cancelled',{timeout:5000},async()=>{
 const db=new FeedbackModel(),entered=deferred(),release=deferred();
 const submit=db.submit('A',id,'suggestion','mensagem fictícia válida',{entered:entered.resolve,wait:()=>release.promise,rollback:true});
 await entered.promise;const cancel=db.cancel('A',id);release.resolve();
 await assert.rejects(submit,/rollback/);assert.equal((await cancel).status,'cancelled');assert.equal((await db.cancel('A',id)).status,'cancelled');assert.equal(db.count,0);
});
test('same user and ID replay is idempotent; differing message conflicts',async()=>{
 const db=new FeedbackModel(),first=await db.submit('A',id,'suggestion','mensagem fictícia válida');
 assert.deepEqual(await db.submit('A',id,'suggestion',' mensagem fictícia válida '),first);
 assert.deepEqual(await db.submit('A',id,'suggestion','mensagem ficti\u0301cia va\u0301lida'),first);
 await assert.rejects(db.submit('A',id,'suggestion','outra mensagem fictícia'),/conflict/);assert.equal(db.count,1);
});
test('same UUID is scoped to owner, with no cross-account status or cancellation',async()=>{
 const db=new FeedbackModel();await db.submit('A',id,'suggestion','mensagem fictícia válida');
 assert.equal(db.status('B',id).status,'unknown');assert.equal((await db.cancel('B',id)).status,'cancelled');
 assert.equal(db.status('A',id).status,'submitted');assert.equal(db.count,1);
});
test('preexisting legacy feedback without barrier never produces a false cancellation',async()=>{
 const db=new FeedbackModel();db.seedLegacy('A',id,'suggestion','mensagem fictícia válida');
 assert.equal(db.status('A',id).status,'unknown');await assert.rejects(db.cancel('A',id),/legacy/);
 await assert.rejects(db.submit('A',id,'suggestion','mensagem fictícia válida'),/legacy/);
 assert.equal(db.status('A',id).status,'unknown');assert.equal(db.count,1);
});
test('marker is written/read before send, carries no text or category, and survives lost response',async()=>{
 const db=new FeedbackModel(),s=storage(),marker={version:1,clientId:id,ownerBinding:bindingA};
 const result=await begin(s,marker,{text:'mensagem fictícia válida',category:'suggestion'},async(payload,clientId)=>{
  assert.deepEqual(inspect(s,bindingA),{status:'pending',clientId:id});
  assert.equal(s.dump().join().includes(payload.text),false);assert.equal(s.dump().join().includes(payload.category),false);
  await db.submit('A',clientId,payload.category,payload.text);throw Error('response lost');
 });
 assert.equal(result.status,'unknown');assert.equal(inspect(s,bindingB).status,'different-owner');
 assert.equal(acceptReceipt(s,bindingB,db.status('A',id)).status,'different-owner');
 assert.equal(acceptReceipt(s,bindingA,db.status('A',id)).status,'submitted');assert.equal(inspect(s,bindingA).status,'none');
});
test('storage failures, corrupt marker and malformed or mismatched receipts never initiate or clear',async()=>{
 let called=0;const marker={version:1,clientId:id,ownerBinding:bindingA};
 const broken={getItem:()=>null,setItem:()=>{throw Error('denied');},removeItem:()=>{}};
 assert.equal((await begin(broken,marker,{},async()=>{called++;})).status,'blocked');assert.equal(called,0);
 const s=storage();s.setItem('feedback-attempt-v1','{bad');
 assert.equal(inspect(s,bindingA).status,'blocked');assert.equal((await begin(s,marker,{},async()=>{called++;})).status,'blocked');
 s.removeItem('feedback-attempt-v1');await begin(s,marker,{},async()=>{called++;});
 for(const receipt of [null,{status:'submitted',clientId:id},{status:'cancelled',clientId:id,extra:true},{status:'cancelled',clientId:'other'},{status:'unknown',clientId:id}]){
  assert.equal(acceptReceipt(s,bindingA,receipt).status,'unknown');assert.equal(inspect(s,bindingA).status,'pending');
 }
});
test('failed read-back or partial write blocks sending and preserves any existing marker',async()=>{
 let count=0,raw=null,reads=0;
 const s={getItem:()=>{reads++;if(reads===2)throw Error('read-back failed');return raw;},setItem:(_key,value)=>{raw=value;},removeItem:()=>{raw=null;}};
 const marker={version:1,clientId:id,ownerBinding:bindingA};
 assert.equal((await begin(s,marker,{},async()=>{count++;})).status,'blocked');
 assert.equal((await begin(s,marker,{},async()=>{count++;})).status,'blocked');
 assert.equal(count,0);assert.equal(inspect(s,bindingA).status,'pending');
});
test('lost cancellation response retains marker until same barrier confirms terminal state',async()=>{
 const db=new FeedbackModel(),s=storage(),marker={version:1,clientId:id,ownerBinding:bindingA};
 await begin(s,marker,{},async()=>{throw Error('post outcome unknown');});
 await db.cancel('A',id); // committed; response is lost rather than accepted by client
 assert.equal(inspect(s,bindingA).status,'pending');
 assert.equal(acceptReceipt(s,bindingA,await db.cancel('A',id)).status,'cancelled');
 assert.equal(inspect(s,bindingA).status,'none');
});
test('the request identifier equals the stored snapshot even if the caller object changes during storage',async()=>{
 const marker={version:1,clientId:id,ownerBinding:bindingA},s=storage(),set=s.setItem;
 s.setItem=(key,value)=>{set(key,value);marker.clientId='10000000-0000-4000-8000-000000000002';};
 let sent;await begin(s,marker,{},async(_payload,clientId)=>{sent=clientId;});
 assert.equal(inspect(s,bindingA).clientId,id);assert.equal(sent,id);
});
