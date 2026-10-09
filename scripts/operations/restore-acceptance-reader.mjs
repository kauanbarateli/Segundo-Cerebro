import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { storageSource } from "./backup-sources.mjs";
import { PERSONAL_REF } from "./backup-config.mjs";
import { MAX_PACKET_BYTES, record, uuid, validateAcceptanceManifest, rejectAcceptance, RestoreAcceptanceError } from "./restore-acceptance-config.mjs";

async function jsonResponse(response,maximum=MAX_PACKET_BYTES) {
 const reader=response.body?.getReader();if(!reader)rejectAcceptance("ACCEPTANCE_REMOTE_UNAVAILABLE");const chunks=[];let bytes=0;
 try{while(true){const next=await reader.read();if(next.done)break;bytes+=next.value.length;if(bytes>maximum){await reader.cancel();rejectAcceptance("ACCEPTANCE_REMOTE_UNAVAILABLE");}chunks.push(Buffer.from(next.value));}return JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch(error){if(error instanceof RestoreAcceptanceError)throw error;rejectAcceptance("ACCEPTANCE_REMOTE_UNAVAILABLE");}finally{reader.releaseLock();}
}
function exact(value,keys){return record(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));}
const base64=(value,minimum,maximum)=>{if(typeof value!=="string"||value.length>65536||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))return false;const bytes=Buffer.from(value,"base64");return bytes.length>=minimum&&bytes.length<=maximum&&bytes.toString("base64")===value;};
const envelope=(value,wrapped=false)=>exact(value,["iv","ciphertext"])&&base64(value.iv,12,12)&&base64(value.ciphertext,wrapped?48:16,wrapped?48:49152);
const instant=value=>typeof value==="string"&&Number.isFinite(Date.parse(value));
export function validateAcceptanceSnapshot(value,manifest) {
 if(!exact(value,["revision","header","items"])||typeof value.revision!=="string"||!/^(0|[1-9][0-9]{0,18})$/.test(value.revision)||!Array.isArray(value.items)||value.items.length!==manifest.vault_item_ids.length||JSON.stringify(value).length>MAX_PACKET_BYTES)rejectAcceptance("ACCEPTANCE_CIPHERTEXT_INVALID");
 const header=value.header;
 if(!exact(header,["user_id","schema_version","master","recovery","consent_at","created_at","updated_at"])||header.user_id!==manifest.fixture_user_id||header.schema_version!==1||![header.consent_at,header.created_at,header.updated_at].every(instant)||!exact(header.master,["kdf","envelope"])||!exact(header.master.kdf,["algorithm","memory_kib","iterations","parallelism","salt"])||header.master.kdf.algorithm!=="argon2id"||header.master.kdf.memory_kib!==65536||header.master.kdf.iterations!==3||header.master.kdf.parallelism!==1||!base64(header.master.kdf.salt,16,16)||!envelope(header.master.envelope,true)||!envelope(header.recovery,true))rejectAcceptance("ACCEPTANCE_CIPHERTEXT_INVALID");
 const ids=new Set();for(const item of value.items){if(!exact(item,["id","user_id","version","envelope","deleted_at","created_at","updated_at"])||!manifest.vault_item_ids.includes(item.id)||ids.has(item.id)||item.user_id!==manifest.fixture_user_id||!Number.isSafeInteger(item.version)||item.version<1||item.version>2147483647||!envelope(item.envelope)||![item.created_at,item.updated_at].every(instant)||(item.deleted_at!==null&&!instant(item.deleted_at)))rejectAcceptance("ACCEPTANCE_CIPHERTEXT_INVALID");ids.add(item.id);}
 return structuredClone(value);
}
export function acceptanceReadSql(manifest,sessionId) {
 manifest=validateAcceptanceManifest(manifest);if(!uuid(sessionId))rejectAcceptance("ACCEPTANCE_IDENTITY_MISMATCH");
 const owner="'"+manifest.fixture_user_id+"'::uuid",session="'"+sessionId+"'::uuid",items=manifest.vault_item_ids.map(id=>"'"+id+"'::uuid").join(","),files=manifest.files.map(file=>"'"+file.id+"'::uuid").join(","),features=["cofre",...new Set(manifest.files.map(file=>({drive:"drive",capture_image:"capturar",avatar:"configuracoes"})[file.kind]))].map(feature=>"'"+feature+"'").join(",");
 return "begin transaction read only; set local statement_timeout='15s'; set local lock_timeout='3s'; "+
 "select jsonb_build_object('actor_ok',app_private.session_active("+owner+","+session+") and not exists(select 1 from public.user_moderation where user_id="+owner+" and must_change_password) and not exists(select 1 from public.user_entitlements where user_id="+owner+" and feature_key in ("+features+") and not allowed),"+
 "'vault',jsonb_build_object('revision',coalesce((select revision::text from app_private.vault_revisions where user_id="+owner+"),'0'),'header',(select payload from public.vault_master_keys where user_id="+owner+"),'items',coalesce((select jsonb_agg(payload order by id) from public.vault_items where user_id="+owner+" and id in ("+items+")),'[]'::jsonb)),"+
 "'files',coalesce((select jsonb_agg(jsonb_build_object('id',id,'user_id',user_id,'kind',kind,'bytes',bytes,'sha256',sha256,'storage_path',storage_path) order by id) from public.drive_files where user_id="+owner+" and id in ("+files+") and deleted_at is null and purged_at is null),'[]'::jsonb)); rollback;";
}
export async function acceptanceQuery(config,sql,spawnProcess=spawn) {
 const child=spawnProcess(config.psql,["--no-psqlrc","--quiet","--tuples-only","--no-align","--set=ON_ERROR_STOP=1","--file=-"],{env:config.pg,stdio:["pipe","pipe","pipe"],shell:false,windowsHide:true});child.stderr?.resume();child.stdin?.on("error",()=>undefined);
 const completed=new Promise((resolve,reject)=>{child.on("error",()=>reject(new RestoreAcceptanceError("ACCEPTANCE_SQL_UNAVAILABLE")));child.on("close",code=>code===0?resolve():reject(new RestoreAcceptanceError("ACCEPTANCE_SQL_UNAVAILABLE")));});completed.catch(()=>undefined);
 const timeout=setTimeout(()=>child.kill(),20000),chunks=[];let size=0;
 try{if(!child.stdout||!child.stdin)rejectAcceptance("ACCEPTANCE_SQL_UNAVAILABLE");child.stdin.end(sql);for await(const chunk of child.stdout){size+=chunk.length;if(size>MAX_PACKET_BYTES){child.kill();rejectAcceptance("ACCEPTANCE_SQL_UNAVAILABLE");}chunks.push(Buffer.from(chunk));}await completed;return JSON.parse(Buffer.concat(chunks).toString("utf8").trim());}catch(error){child.kill();if(error instanceof RestoreAcceptanceError)throw error;rejectAcceptance("ACCEPTANCE_SQL_UNAVAILABLE");}finally{clearTimeout(timeout);}
}
export async function readRestoredAcceptance(config,manifest,dependencies={}) {
 manifest=validateAcceptanceManifest(manifest);if(config.origin!=="https://"+manifest.target_project_ref+".supabase.co")rejectAcceptance("ACCEPTANCE_TARGET_MISMATCH");const fetcher=dependencies.fetch??fetch,query=dependencies.query??(sql=>acceptanceQuery(config,sql,dependencies.spawn));
 async function request(path,{method="GET",headers={},body,empty=false,management=false}={}) {
  const allowed=management?method==="GET"&&["/v1/projects/"+PERSONAL_REF,"/v1/projects/"+manifest.target_project_ref].includes(path):["POST /auth/v1/token?grant_type=password","GET /auth/v1/user","POST /auth/v1/logout?scope=local"].includes(method+" "+path);
  if(!allowed)rejectAcceptance("ACCEPTANCE_REQUEST_REFUSED");let reply;try{reply=await fetcher((management?"https://api.supabase.com":config.origin)+path,{method,headers,body,redirect:"error",cache:"no-store",signal:AbortSignal.timeout(20000)});}catch{rejectAcceptance("ACCEPTANCE_REMOTE_UNAVAILABLE");}
  if(!reply.ok){void reply.body?.cancel().catch(()=>undefined);rejectAcceptance("ACCEPTANCE_REMOTE_UNAVAILABLE");}if(empty){void reply.body?.cancel().catch(()=>undefined);return null;}return jsonResponse(reply,management?65536:MAX_PACKET_BYTES);
 }
 // Organization identity comes from provider metadata, never a project name or
 // the operator's confirmation alone. No target data/auth precedes these GETs.
 for(const ref of [PERSONAL_REF,manifest.target_project_ref]){const project=await request("/v1/projects/"+ref,{management:true,headers:{Authorization:"Bearer "+config.managementToken}});if(!record(project)||(project.ref??project.id)!==ref||project.organization_id!==manifest.personal_organization_id)rejectAcceptance("ACCEPTANCE_PERSONAL_ORGANIZATION_MISMATCH");}
 let token=null,result=null,failure=null;
 try {
  const login=await request("/auth/v1/token?grant_type=password",{method:"POST",headers:{apikey:config.publishableKey,"Content-Type":"application/json"},body:JSON.stringify({email:config.email,password:config.password})});
  if(typeof login?.access_token!=="string"||login.access_token.length>32768)rejectAcceptance("ACCEPTANCE_IDENTITY_MISMATCH");token=login.access_token;
  const user=await request("/auth/v1/user",{headers:{apikey:config.publishableKey,Authorization:"Bearer "+token}});
  let claims;try{claims=JSON.parse(Buffer.from(token.split(".")[1]??"","base64url").toString("utf8"));}catch{rejectAcceptance("ACCEPTANCE_IDENTITY_MISMATCH");}
  if(!record(user)||user.id!==manifest.fixture_user_id||user.is_anonymous===true||typeof user.email!=="string"||user.email.toLowerCase()!==config.email.toLowerCase()||!record(claims)||claims.sub!==user.id||claims.iss!==config.origin+"/auth/v1"||!uuid(claims.session_id)||!Number.isSafeInteger(claims.exp)||claims.exp*1000<=Date.now()+30000)rejectAcceptance("ACCEPTANCE_IDENTITY_MISMATCH");
  // getUser has just validated this token with the provider. The extracted
  // session id is then checked against live Auth/moderation in the read-only SQL.
  const rows=await query(acceptanceReadSql(manifest,claims.session_id));if(!exact(rows,["actor_ok","vault","files"])||rows.actor_ok!==true||!Array.isArray(rows.files)||rows.files.length!==manifest.files.length)rejectAcceptance("ACCEPTANCE_DATA_MISMATCH");
  const vault=validateAcceptanceSnapshot(rows.vault,manifest),storage=dependencies.download??(metadata=>storageSource(config.origin,config.storageKey).download(metadata));
  const ids=new Set();for(const row of rows.files){const expected=manifest.files.find(file=>file.id===row?.id);if(!expected||!exact(row,["id","user_id","kind","bytes","sha256","storage_path"])||ids.has(row.id)||row.user_id!==manifest.fixture_user_id||row.kind!==expected.kind||row.bytes!==expected.bytes||row.sha256!==expected.sha256||row.storage_path!==manifest.fixture_user_id+"/"+row.id)rejectAcceptance("ACCEPTANCE_DATA_MISMATCH");ids.add(row.id);
   const digest=createHash("sha256"),stream=await storage({bucket:"second-brain-files",path:row.storage_path});let bytes=0;try{for await(const chunk of stream){bytes+=chunk.length;if(bytes>expected.bytes)rejectAcceptance("ACCEPTANCE_OBJECT_MISMATCH");digest.update(chunk);}}finally{stream.destroy?.();}
   if(bytes!==expected.bytes||digest.digest("hex")!==expected.sha256)rejectAcceptance("ACCEPTANCE_OBJECT_MISMATCH");
  }
  result={version:1,source_project_ref:PERSONAL_REF,target_project_ref:manifest.target_project_ref,archive_sha256:manifest.archive_sha256,fixture_user_id:manifest.fixture_user_id,vault,files_verified:manifest.files.length,created_at:new Date().toISOString()};
 }catch(error){failure=error instanceof RestoreAcceptanceError?error:new RestoreAcceptanceError("ACCEPTANCE_UNAVAILABLE");}
 finally{if(token){try{await request("/auth/v1/logout?scope=local",{method:"POST",headers:{apikey:config.publishableKey,Authorization:"Bearer "+token},empty:true});}catch{failure=new RestoreAcceptanceError("ACCEPTANCE_LOGOUT_FAILED");}token=null;}}
 if(failure)throw failure;return result;
}
