// Parent runner must supply a container ID already inspected as owned and network:none.
// Do not use this adapter independently or with a hosted database.
import {spawn} from 'node:child_process';
const ID=/^[a-f0-9]{64}$/,fail=()=>{throw Error('SESSION_REFUSED');};
export function sessionArgs(id){if(!ID.test(id))fail();return ['exec','--interactive','--user','postgres',id,'psql','--no-psqlrc','--no-password','--quiet','--tuples-only','--no-align','--set','ON_ERROR_STOP=1','--host','/var/run/postgresql','--username','postgres','--dbname','postgres','--file=-'];}
export function openDockerSession({id,cwd,env,checkSql,spawnProcess=spawn,groupAbsent,timeoutMs=12000}){
 if(!ID.test(id)||typeof cwd!=='string'||!env||typeof checkSql!=='function'||typeof spawnProcess!=='function'||typeof groupAbsent!=='function'||!Number.isSafeInteger(timeoutMs)||timeoutMs<100||timeoutMs>20000)fail();
 let child,closed=false,exitCode=null,failed=false,groupGone=false,buffer='',total=0,waiter=null;const queue=[];
 let terminalResolve;const terminal=new Promise(resolve=>{terminalResolve=resolve;});
 function rejectWaiting(){if(waiter){const w=waiter;waiter=null;clearTimeout(w.timer);w.reject(Error('SESSION_REFUSED'));}}
 function reject(){failed=true;rejectWaiting();}
 try{child=spawnProcess('docker',sessionArgs(id),{cwd,env,shell:false,detached:true,stdio:['pipe','pipe','pipe']});
  child.stdout.on('data',chunk=>{if(failed)return;total+=chunk.length;if(total>32768){reject();return;}buffer+=chunk.toString('utf8');let at;while((at=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,at).trim();buffer=buffer.slice(at+1);if(!line)continue;let value;try{value=JSON.parse(line);}catch{reject();return;}if(waiter){const w=waiter;waiter=null;clearTimeout(w.timer);w.resolve(value);}else queue.push(value);if(queue.length>16){reject();return;}}});
  child.stderr.on('data',chunk=>{total+=chunk.length;if(total>32768)reject();});child.stdin.on('error',reject);child.on('error',reject);
  child.on('close',code=>{closed=true;exitCode=code;if(buffer.trim()||code!==0)reject();rejectWaiting();terminalResolve();});
 }catch{reject();terminalResolve();}
 return Object.freeze({
  async send(sql){if(failed||closed||typeof sql!=='string'||Buffer.byteLength(sql)>65536)fail();try{checkSql(Buffer.from(sql));}catch{fail();}await new Promise((resolve,rejectWrite)=>{let settled=false;const timer=setTimeout(()=>{settled=true;failed=true;rejectWrite(Error('SESSION_REFUSED'));},timeoutMs);child.stdin.write(sql+'\n',error=>{if(settled)return;settled=true;clearTimeout(timer);if(error){failed=true;rejectWrite(Error('SESSION_REFUSED'));}else resolve();});});},
  async read(){if(failed)fail();if(queue.length)return queue.shift();if(closed||waiter)fail();return new Promise((resolve,rejectRead)=>{const timer=setTimeout(()=>{waiter=null;failed=true;rejectRead(Error('SESSION_REFUSED'));},timeoutMs);waiter={resolve,reject:rejectRead,timer};});},
  async close(){try{if(child&&!closed)child.stdin.end();}catch{reject();}let timer;await Promise.race([terminal,new Promise(resolve=>{timer=setTimeout(resolve,timeoutMs);})]);clearTimeout(timer);if(!closed){reject();try{if(Number.isSafeInteger(child?.pid)&&child.pid>1)process.kill(-child.pid,'SIGKILL');}catch{}}try{groupGone=await groupAbsent(child?.pid)===true;}catch{groupGone=false;}return closed&&exitCode===0&&!failed&&queue.length===0&&groupGone;},
  state(){return Object.freeze({closed,groupGone});}
 });
}
