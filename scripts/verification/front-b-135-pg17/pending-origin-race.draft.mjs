// Only the inspected network:none runner may provide ports. No hosted connection.
import { createHash } from 'node:crypto';
import { origin218FreezePlan } from './origin-218-freeze-exception.draft.mjs';
const digest=b=>createHash('sha256').update(b).digest('hex'), fail=()=>{throw Error('PENDING_ORIGIN_RACE_REFUSED');};
const pin='7d34cef6d839dca2bbc71b37f62cb8818693ba3e06e203989c7e353f0088ac84';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const pid=x=>Number.isSafeInteger(x)&&x>1;
const once=(s,a,b)=>{if(s.split(a).length!==2)fail();return s.replace(a,b);};
function extract(s,start,end){if(s.split(start).length!==2)fail();const a=s.indexOf(start),b=s.indexOf(end,a);if(b<0)fail();return s.slice(a,b+end.length);}
export function pendingOriginPlan(ctx,inputs,kind){
 if(!exact(ctx,['nonce','systemIdentifier','user','session','intent','request'])||!/^[a-f0-9]{32}$/.test(ctx.nonce)||!/^\d{16,20}$/.test(ctx.systemIdentifier)||['user','session','intent','request'].some(k=>!uuid.test(ctx[k]))||!['reserve-first','withdraw-reserve','finish-first','withdraw-finish'].includes(kind))fail();
 if(!Buffer.isBuffer(inputs.pending)||digest(inputs.pending)!==pin)fail();
 const prior=origin218FreezePlan({nonce:ctx.nonce,systemIdentifier:ctx.systemIdentifier,user:ctx.user,session:ctx.session},inputs.freeze,inputs.candidate,'commit',inputs.foundation);
 const a=prior.setup.indexOf('do $fixture_guard$'),b=prior.setup.indexOf('-- Persist beyond the transaction;');if(a<0||b<a)fail();const legacy=prior.setup.slice(a,b),foundation=inputs.foundation.toString('utf8');
 const defs=[['CREATE FUNCTION app_private.draft_confirm_complete(','\nEND $$;'],['CREATE FUNCTION app_private.draft_finish_fenced(','\nEND $$;'],['CREATE FUNCTION public.signup_fence_reserve(','$$;'],['CREATE FUNCTION public.signup_fence_finish(','$$;']].map(([start,end])=>extract(foundation,start,end)).join('\n');
 const v2Guard="DO $guard$ BEGIN RAISE EXCEPTION 'GUARDED: review cutover and exact database provenance'; END $guard$;";
 const pendingGuard="DO $guard$ BEGIN RAISE EXCEPTION 'GUARDED: pending consent revision is not qualified'; END $guard$;";
 const unwrap=(text,guard)=>{const s=once(text,guard,'');if(!s.trimStart().startsWith('--')||!s.trimEnd().endsWith('COMMIT;')||s.split('BEGIN;').length!==2||s.split('COMMIT;').length!==2)fail();return s.slice(s.indexOf('BEGIN;')+6,s.lastIndexOf('COMMIT;'));};
 const v2=unwrap(inputs.candidate.toString('utf8'),v2Guard),pending=unwrap(inputs.pending.toString('utf8'),pendingGuard);
 const setup=`begin;${legacy}\n${defs}\ncreate table app_private.signup_password_proofs(intent_id uuid primary key,user_id uuid,session_id uuid,expires_at timestamptz,consumed_at timestamptz);create table app_private.onboarding_entries(user_id uuid,source_operation uuid,source_kind text,source_intent uuid);update app_private.signup_intents set expires_at=clock_timestamp()+interval '1 hour' where id='${ctx.intent}'::uuid;${v2}\n${pending}\ncommit;`;
 const initial=`select json_build_object('kind','initial','result',public.signup_origin_status_v2('${ctx.user}'::uuid,'${ctx.session}'::uuid));`;
 const scope=`'${ctx.user}'::uuid,'${ctx.session}'::uuid,'${ctx.intent}'::uuid,repeat('a',64),'${ctx.request}'::uuid`;
 const reserve=rev=>{if(typeof rev!=='string'||!uuid.test(rev))fail();return `public.signup_fence_reserve_origin_v2(${scope},'terms-v1','privacy-v1',true,'origin-v1','${rev}'::uuid)`;};
 const withdraw=rev=>{if(typeof rev!=='string'||!uuid.test(rev))fail();return `public.signup_origin_withdraw_v2('${ctx.user}'::uuid,'${ctx.session}'::uuid,'${rev}'::uuid)`;};
 const finish=gen=>{if(typeof gen!=='string'||!uuid.test(gen))fail();return `public.signup_fence_finish_origin_v2(${scope},'${gen}'::uuid,'terms-v1','privacy-v1','origin-v1')`;};
 const prep=rev=>`begin;select json_build_object('kind','reserved','result',${reserve(rev)});commit;`;
 const proof=gen=>{if(typeof gen!=='string'||!uuid.test(gen))fail();return `begin;update app_private.signup_completion_fences_draft set phase='password_acknowledged' where user_id='${ctx.user}'::uuid and generation='${gen}'::uuid and phase='reserved';insert into app_private.signup_password_proofs values ('${ctx.intent}'::uuid,'${ctx.user}'::uuid,'${ctx.session}'::uuid,clock_timestamp()+interval '10 minutes',null);commit;`;};
 const prefix=`sc.fb.pending.${ctx.nonce}`,timeouts="set local statement_timeout='20s';set local lock_timeout='15s';";
 const first=(rev,gen)=>{const op=kind==='reserve-first'?reserve(rev):kind==='finish-first'?finish(gen):withdraw(rev);return `begin;${timeouts}set local application_name='${prefix}.a';select json_build_object('kind','first-pid','pid',pg_backend_pid());set local role service_role;select json_build_object('kind','first-result','result',${op});`;};
 const second=(rev,gen)=>{const op=kind==='withdraw-reserve'?reserve(rev):kind==='withdraw-finish'?finish(gen):withdraw(rev);return `begin;${timeouts}set local application_name='${prefix}.b';select json_build_object('kind','second-pid','pid',pg_backend_pid());set local role service_role;select json_build_object('kind','second-result','result',${op});`;};
 const wait=(p,q)=>{if(!pid(p)||!pid(q)||p===q)fail();return `begin read only;select pg_stat_clear_snapshot();select json_build_object('kind','wait','blocked',${p}=any(pg_blocking_pids(${q})),'firstBound',exists(select 1 from pg_stat_activity where pid=${p} and application_name='${prefix}.a'),'secondBound',exists(select 1 from pg_stat_activity where pid=${q} and application_name='${prefix}.b' and state='active'));rollback;`;};
 const final=rev=>{if(typeof rev!=='string'||!uuid.test(rev))fail();return `select json_build_object('kind','final','bound',exists(select 1 from app_private.signup_intents where id='${ctx.intent}'::uuid and state='bound'),'consumed',exists(select 1 from app_private.signup_intents where id='${ctx.intent}'::uuid and state='consumed'),'intentOrigin',exists(select 1 from app_private.signup_intents where id='${ctx.intent}'::uuid and origin is not null),'origin',exists(select 1 from app_private.signup_origins where user_id='${ctx.user}'::uuid),'newRevision',exists(select 1 from app_private.signup_origins where user_id='${ctx.user}'::uuid and origin_revision<>'${rev}'::uuid),'fence',exists(select 1 from app_private.signup_completion_fences_draft where user_id='${ctx.user}'::uuid),'withdrawn',coalesce((select origin_withdrawn from app_private.signup_completion_fences_draft where user_id='${ctx.user}'::uuid),false),'complete',exists(select 1 from app_private.signup_completion_fences_draft where user_id='${ctx.user}'::uuid and phase='complete'));`;};
 return Object.freeze({setup,initial,prep,proof,first,second,wait,final});
}
export async function observePendingOriginRace(ports,ctx,inputs,kind){
 if(!ports||['open','query','exec','pause'].some(k=>typeof ports[k]!=='function'))fail();const p=pendingOriginPlan(ctx,inputs,kind);let a,b,closedA=false,closedB=false,error,phase='setup';
 const receipt=(x,label)=>exact(x,['kind','pid'])&&x.kind===label&&pid(x.pid);
 try{
  await ports.exec(p.setup);const initial=await ports.query(p.initial);const rev=initial?.result?.revision;if(initial?.kind!=='initial'||initial.result?.status!=='active'||typeof rev!=='string'||!uuid.test(rev))fail();let gen=null;
  if(kind.includes('finish')){phase='prepare-fence';const r=await ports.query(p.prep(rev));gen=r?.result?.generation;if(r?.kind!=='reserved'||r.result?.status!=='acquired'||typeof gen!=='string'||!uuid.test(gen))fail();await ports.exec(p.proof(gen));}
  a=await ports.open();b=await ports.open();if(!a||!b||a===b)fail();phase='first';await a.send(p.first(rev,gen));const ar=await a.read();if(!receipt(ar,'first-pid'))fail();const first=await a.read();
  if(first?.kind!=='first-result'||(kind==='reserve-first'?first.result?.status!=='acquired':kind==='finish-first'?first.result!==true:first.result?.status!=='withdrawn'))fail();
  phase='waiting';await b.send(p.second(rev,gen));const br=await b.read();if(!receipt(br,'second-pid')||ar.pid===br.pid)fail();let observed=false;
  for(let i=0;i<50;i++){const w=await ports.query(p.wait(ar.pid,br.pid));if(!exact(w,['kind','blocked','firstBound','secondBound'])||w.kind!=='wait'||['blocked','firstBound','secondBound'].some(k=>typeof w[k]!=='boolean'))fail();if(w.blocked&&w.firstBound&&w.secondBound){observed=true;break;}await ports.pause();}if(!observed)fail();
  phase='commit-first';await a.send("reset role;commit;select json_build_object('kind','committed','pid',pg_backend_pid());");const done=await a.read();if(!exact(done,['kind','pid'])||done.kind!=='committed'||done.pid!==ar.pid)fail();
  phase='second';const second=await b.read();if(second?.kind!=='second-result'||(kind==='reserve-first'?second.result?.status!=='withdrawn':kind==='withdraw-finish'?second.result!==true:second.result?.status!=='stale'))fail();
  await b.send("reset role;commit;select json_build_object('kind','committed','pid',pg_backend_pid());");const doneB=await b.read();if(!exact(doneB,['kind','pid'])||doneB.kind!=='committed'||doneB.pid!==br.pid)fail();
  phase='verify';const f=await ports.query(p.final(rev)),expected={ 'reserve-first':[true,false,false,false,false,true,true,false], 'withdraw-reserve':[true,false,false,false,false,false,false,false], 'finish-first':[false,true,false,true,true,true,false,true], 'withdraw-finish':[false,true,false,false,false,true,true,true] }[kind],keys=['bound','consumed','intentOrigin','origin','newRevision','fence','withdrawn','complete'];
  if(!exact(f,['kind',...keys])||f.kind!=='final'||keys.some((k,i)=>f[k]!==expected[i]))fail();
 }catch(e){error=e;}finally{try{if(a)closedA=await a.close()===true;}catch{}try{if(b)closedB=await b.close()===true;}catch{}}
 if(error||!closedA||!closedB){process.stderr.write(JSON.stringify({code:'PENDING_ORIGIN_RACE_REFUSED',kind,phase,closedA,closedB})+'\n');fail();}
 return Object.freeze({scenario:`pending-origin-${kind}-pg17`,status:'CASE_OBSERVED_CLEANUP_PENDING',acceptance:false,hostedCertified:false});
}
