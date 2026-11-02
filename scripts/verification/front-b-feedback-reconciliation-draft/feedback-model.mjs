// Transaction/lock model, not PostgreSQL, authentication, a route or a data store.
export class FeedbackModel {
 #records=new Map();#messages=new Map();#locks=new Map();#counter=0;
 #key(owner,id){return `${owner}:${id}`;}
 async #withLock(owner,id,operation){
  const key=this.#key(owner,id),previous=this.#locks.get(key)??Promise.resolve();let release;
  const barrier=new Promise(resolve=>{release=resolve;}),tail=previous.then(()=>barrier);
  this.#locks.set(key,tail);await previous;
  try{return await operation(key);}finally{release();if(this.#locks.get(key)===tail)this.#locks.delete(key);}
 }
 status(owner,id){const record=this.#records.get(this.#key(owner,id));return record ? {...record,clientId:id} : {status:'unknown',clientId:id};}
 async submit(owner,id,category,message,{entered=()=>{},wait=async()=>{},rollback=false}={}){
  return this.#withLock(owner,id,async key=>{
   entered();await wait();const previous=this.#records.get(key);
   if(previous?.status==='cancelled')return {status:'cancelled',clientId:id};
   const text=message.normalize('NFC').trim(),old=this.#messages.get(key);
   if(previous?.status==='submitted'){
    if(old.category!==category || old.text!==text)throw Error('conflict');
    return {...previous,clientId:id};
   }
   if(old)throw Error('legacy without barrier');
   if(rollback)throw Error('rollback');
   const feedbackId=`90000000-0000-4000-8000-${String(++this.#counter).padStart(12,'0')}`;
   this.#messages.set(key,{category,text});this.#records.set(key,{status:'submitted',feedbackId});
   return {status:'submitted',feedbackId,clientId:id};
  });
 }
 async cancel(owner,id,{entered=()=>{},wait=async()=>{}}={}){
  return this.#withLock(owner,id,async key=>{
   entered();await wait();const previous=this.#records.get(key);
   if(previous)return {...previous,clientId:id};
   if(this.#messages.has(key))throw Error('legacy without barrier');
   this.#records.set(key,{status:'cancelled'});return {status:'cancelled',clientId:id};
  });
 }
 seedLegacy(owner,id,category,text){this.#messages.set(this.#key(owner,id),{category,text});}
 get count(){return this.#messages.size;}
}
