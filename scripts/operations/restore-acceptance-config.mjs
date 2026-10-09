import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { PERSONAL_REF, postgresEnvironment, safeBackupDirectory } from "./backup-config.mjs";

export class RestoreAcceptanceError extends Error {
 constructor(code) { super(code); this.name="RestoreAcceptanceError"; this.code=code; }
}
export const rejectAcceptance=code=>{throw new RestoreAcceptanceError(code);};
export const uuid=value=>typeof value==="string"&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export const record=value=>value!==null&&typeof value==="object"&&!Array.isArray(value);
const exact=(value,keys)=>record(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const hash=value=>typeof value==="string"&&/^[a-f0-9]{64}$/.test(value);
const text=value=>typeof value==="string"&&value.length>0&&value.length<=200&&!/[\u0000-\u001f\u007f]/.test(value);
export const MAX_PACKET_BYTES=1024*1024;
export function validateAcceptanceManifest(value) {
 const fields=["version","source_project_ref","target_project_ref","personal_organization_id","archive_sha256","fixture_user_id","vault_item_ids","files"];
 if(!exact(value,fields)||value.version!==1||value.source_project_ref!==PERSONAL_REF||typeof value.target_project_ref!=="string"||!/^[a-z]{20}$/.test(value.target_project_ref)||value.target_project_ref===PERSONAL_REF||!text(value.personal_organization_id)||!hash(value.archive_sha256)||!uuid(value.fixture_user_id)||!Array.isArray(value.vault_item_ids)||value.vault_item_ids.length<1||value.vault_item_ids.length>10||value.vault_item_ids.some(id=>!uuid(id))||new Set(value.vault_item_ids).size!==value.vault_item_ids.length||!Array.isArray(value.files)||value.files.length<1||value.files.length>10)rejectAcceptance("INVALID_ACCEPTANCE_MANIFEST");
 for(const file of value.files)if(!exact(file,["id","kind","sha256","bytes"])||!uuid(file.id)||!["drive","capture_image","avatar"].includes(file.kind)||!hash(file.sha256)||!Number.isSafeInteger(file.bytes)||file.bytes<1||file.bytes>100*1024*1024)rejectAcceptance("INVALID_ACCEPTANCE_MANIFEST");
 if(new Set(value.files.map(file=>file.id)).size!==value.files.length)rejectAcceptance("INVALID_ACCEPTANCE_MANIFEST");
 return structuredClone(value);
}
export function assertAcceptanceOperator(environment) {
 if(["CI","CONTINUOUS_INTEGRATION","VERCEL","VERCEL_ENV","NETLIFY","CF_PAGES","AWS_LAMBDA_FUNCTION_NAME","NEXT_RUNTIME"].some(name=>environment[name]!==undefined&&environment[name]!==""&&environment[name]!=="false")||environment.NODE_ENV==="production")rejectAcceptance("LOCAL_OPERATOR_ONLY");
}
const required=(environment,name)=>{const value=environment[name];if(typeof value!=="string"||!value||value.length>8192||/[\u0000\r\n]/.test(value))rejectAcceptance("ACCEPTANCE_CONFIGURATION_REQUIRED");return value;};
export function acceptanceConfiguration(environment,manifest) {
 assertAcceptanceOperator(environment);
 if(environment.SC_RESTORE_ACCEPT_EXECUTE!=="YES"||environment.SC_RESTORE_ACCEPT_ISOLATED!=="YES"||environment.SC_RESTORE_ACCEPT_CONFIRM_PROJECT!==manifest.target_project_ref||environment.SC_RESTORE_ACCEPT_CONFIRM_USER!==manifest.fixture_user_id)rejectAcceptance("ACCEPTANCE_CONFIRMATION_REQUIRED");
 const origin="https://"+manifest.target_project_ref+".supabase.co";
 if(environment.SC_RESTORE_ACCEPT_SUPABASE_URL!==origin)rejectAcceptance("ACCEPTANCE_TARGET_MISMATCH");
 const managementToken=required(environment,"SC_RESTORE_ACCEPT_MANAGEMENT_PAT"),publishableKey=required(environment,"SC_RESTORE_ACCEPT_PUBLISHABLE_KEY"),storageKey=required(environment,"SC_RESTORE_ACCEPT_STORAGE_KEY"),email=required(environment,"SC_RESTORE_ACCEPT_AUTH_EMAIL"),password=required(environment,"SC_RESTORE_ACCEPT_AUTH_PASSWORD"),psql=required(environment,"SC_RESTORE_ACCEPT_PSQL");
 if(!/^sbp_[A-Za-z0-9_-]{10,}$/.test(managementToken)||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)||!/^sb_secret_[A-Za-z0-9_-]+$/.test(storageKey)||!/^\S+@\S+\.\S+$/.test(email)||email.length>254||password.length>4096||!isAbsolute(psql))rejectAcceptance("ACCEPTANCE_CONFIGURATION_REQUIRED");
 const selected={};for(const name of ["PATH","SystemRoot","TEMP","TMP","HOME"])if(environment[name])selected[name]=environment[name];for(const name of ["PGHOST","PGPORT","PGDATABASE","PGUSER","PGPASSWORD","PGSSLMODE","PGSSLROOTCERT"])if(environment["SC_RESTORE_ACCEPT_"+name])selected[name]=environment["SC_RESTORE_ACCEPT_"+name];
 let pg;try{pg=postgresEnvironment(selected,manifest.target_project_ref);}catch{rejectAcceptance("ACCEPTANCE_POSTGRES_TARGET_MISMATCH");}
 return {origin,managementToken,publishableKey,storageKey,email,password,psql,pg,outputDirectory:required(environment,"SC_RESTORE_ACCEPT_OUTPUT_DIRECTORY")};
}
// chmod is insufficient on NTFS. Only this user's SID, SYSTEM and Administrators
// may have Allow entries. No credential or raw ACL is sent to argv/output.
const ACL_SCRIPT="$ErrorActionPreference='Stop'; $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value; foreach($rule in (Get-Acl -LiteralPath $env:SC_ACCEPT_ACL_PATH).Access){if($rule.AccessControlType -eq 'Allow' -and $rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -notin @($sid,'S-1-5-18','S-1-5-32-544')){exit 1}}; Write-Output '{\"private\":true}'";
export async function assertPrivatePermissions(path,dependencies={}) {
 const info=await lstat(path);if(info.isSymbolicLink()||(!info.isDirectory()&&!info.isFile()))rejectAcceptance("PRIVATE_ACCEPTANCE_PATH_REQUIRED");
 if((dependencies.platform??process.platform)!=="win32"){if(info.mode&0o077)rejectAcceptance("PRIVATE_ACCEPTANCE_PERMISSIONS_REQUIRED");return;}
 const environment=dependencies.environment??process.env,executable=join(environment.SystemRoot??"C:/Windows","System32","WindowsPowerShell","v1.0","powershell.exe"),child=(dependencies.spawn??spawn)(executable,["-NoProfile","-NonInteractive","-Command",ACL_SCRIPT],{env:{SystemRoot:environment.SystemRoot??"C:/Windows",SC_ACCEPT_ACL_PATH:path},stdio:["ignore","pipe","pipe"],shell:false,windowsHide:true});
 child.stderr?.resume();let bytes=0;const chunks=[],timeout=setTimeout(()=>child.kill(),10000);
 const completed=new Promise((resolve,reject)=>{child.on("error",()=>reject(new RestoreAcceptanceError("PRIVATE_ACCEPTANCE_PERMISSIONS_REQUIRED")));child.on("close",code=>code===0?resolve():reject(new RestoreAcceptanceError("PRIVATE_ACCEPTANCE_PERMISSIONS_REQUIRED")));});completed.catch(()=>undefined);
 try{if(!child.stdout)rejectAcceptance("PRIVATE_ACCEPTANCE_PERMISSIONS_REQUIRED");for await(const chunk of child.stdout){bytes+=chunk.length;if(bytes>1024){child.kill();rejectAcceptance("PRIVATE_ACCEPTANCE_PERMISSIONS_REQUIRED");}chunks.push(Buffer.from(chunk));}await completed;if(Buffer.concat(chunks).toString("utf8").trim()!=='{"private":true}')rejectAcceptance("PRIVATE_ACCEPTANCE_PERMISSIONS_REQUIRED");}finally{clearTimeout(timeout);}
}
export async function privateAcceptanceDirectory(path,environment,dependencies={}) {
 let result;try{result=await safeBackupDirectory(path,{forbiddenRoots:[environment.SC_BACKUP_APP_SERVING_ROOT,environment.SC_BACKUP_WORK_ROOT].filter(Boolean),syncRoots:[environment.OneDrive,environment.OneDriveConsumer,environment.OneDriveCommercial].filter(Boolean)});}catch{rejectAcceptance("PRIVATE_ACCEPTANCE_PATH_REQUIRED");}
 await (dependencies.assertPrivate??assertPrivatePermissions)(result);return result;
}
export async function readPrivateAcceptanceManifest(path,environment,dependencies={}) {
 if(typeof path!=="string"||!isAbsolute(path))rejectAcceptance("PRIVATE_ACCEPTANCE_PATH_REQUIRED");
 await privateAcceptanceDirectory(dirname(resolve(path)),environment,dependencies);await (dependencies.assertPrivate??assertPrivatePermissions)(path);
 const before=await lstat(path),file=await open(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
 try{const actual=await file.stat();if(!actual.isFile()||actual.size>16384||actual.ino!==before.ino||actual.dev!==before.dev)rejectAcceptance("PRIVATE_ACCEPTANCE_PATH_REQUIRED");let value;try{value=JSON.parse(await file.readFile("utf8"));}catch{rejectAcceptance("INVALID_ACCEPTANCE_MANIFEST");}return validateAcceptanceManifest(value);}finally{await file.close();}
}
