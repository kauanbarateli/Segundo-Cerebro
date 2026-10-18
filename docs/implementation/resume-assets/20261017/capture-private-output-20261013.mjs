/** Owned NTFS output only. Import is inert; no GitHub, log or profile access. */
import * as nativeFs from "node:fs/promises";
import { spawn as nativeSpawn } from "node:child_process";
import { createHash } from "node:crypto";
import { win32 } from "node:path";

export const PRIVATE_CAPTURE_ACL = String.raw`$ErrorActionPreference='Stop'
try {
 $target=$env:SC_CAPTURE_TARGET;$parent=$env:SC_CAPTURE_PARENT;$kind=$env:SC_CAPTURE_KIND
 if($kind -notin @('parent','directory','file')){throw 'REFUSED'}
 $item=Get-Item -LiteralPath $target -Force
 if(-not $item.FullName.Equals([IO.Path]::GetFullPath($target),[StringComparison]::OrdinalIgnoreCase)){throw 'REFUSED'}
 $ancestor=$item
 while($ancestor){if(($ancestor.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'REFUSED'};if($ancestor -is [IO.FileInfo]){$ancestor=$ancestor.Directory}else{$ancestor=$ancestor.Parent}}
 $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User
 $acl=Get-Acl -LiteralPath $target
 if($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid.Value){throw 'REFUSED'}
 if($kind -eq 'parent'){
  if(-not $item.PSIsContainer){throw 'REFUSED'}
  $full=$false
  foreach($rule in $acl.Access){if($rule.AccessControlType -eq 'Allow'){$actor=$rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value;if($actor -notin @($sid.Value,'S-1-5-18','S-1-5-32-544')){throw 'REFUSED'};if($actor -eq $sid.Value -and (($rule.FileSystemRights -band [Security.AccessControl.FileSystemRights]::FullControl) -eq [Security.AccessControl.FileSystemRights]::FullControl)){$full=$true}}}
  if(-not $full){throw 'REFUSED'}
 }else{
  if(-not $item.DirectoryName -and -not $item.PSIsContainer){throw 'REFUSED'}
  $parentPath=if($item.PSIsContainer){$item.Parent.FullName}else{$item.DirectoryName}
  if(-not $parentPath.Equals([IO.Path]::GetFullPath($parent),[StringComparison]::OrdinalIgnoreCase)){throw 'REFUSED'}
  if($kind -eq 'directory'){
   if(-not $item.PSIsContainer){throw 'REFUSED'}
   $entries=[IO.Directory]::EnumerateFileSystemEntries($target).GetEnumerator()
   try{if($entries.MoveNext()){throw 'REFUSED'}}finally{$entries.Dispose()}
   $protected=[Security.AccessControl.DirectorySecurity]::new();$protected.SetAccessRuleProtection($true,$false);$protected.SetOwner($sid)
   $rule=[Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow');$protected.AddAccessRule($rule)
   Set-Acl -LiteralPath $target -AclObject $protected
  }elseif($item.PSIsContainer){throw 'REFUSED'}
  $verified=Get-Acl -LiteralPath $target;$rules=@($verified.Access)
  if($verified.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid.Value -or $rules.Count -ne 1 -or $rules[0].AccessControlType -ne 'Allow' -or $rules[0].IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -ne $sid.Value -or ($rules[0].FileSystemRights -band [Security.AccessControl.FileSystemRights]::FullControl) -ne [Security.AccessControl.FileSystemRights]::FullControl){throw 'REFUSED'}
  if($kind -eq 'directory' -and (-not $verified.AreAccessRulesProtected -or $rules[0].InheritanceFlags -ne ([Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [Security.AccessControl.InheritanceFlags]::ObjectInherit) -or $rules[0].PropagationFlags -ne [Security.AccessControl.PropagationFlags]::None)){throw 'REFUSED'}
 }
 [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);[Console]::WriteLine('{"private":true}');exit 0
}catch{[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);[Console]::WriteLine('{"private":false}');exit 1}`;
export const PRIVATE_CAPTURE_ACL_SHA256 = createHash("sha256").update(PRIVATE_CAPTURE_ACL).digest("hex");
const fail = code => { throw Error(code); };
const dataValue=(value,key)=>{try{const descriptor=Object.getOwnPropertyDescriptor(value??{},key);return descriptor&&Object.hasOwn(descriptor,"value")?descriptor.value:undefined;}catch{return undefined;}};
const own = (value, key) => { let descriptor;try{descriptor=Object.getOwnPropertyDescriptor(value??{},key);}catch{fail("PRIVATE_PATH_REFUSED");}if(!descriptor?.enumerable||!Object.hasOwn(descriptor,"value"))fail("PRIVATE_PATH_REFUSED");return descriptor.value; };
const arraySnapshot=(value,limit)=>{try{if(!Array.isArray(value))fail("PRIVATE_PATH_REFUSED");const length=dataValue(value,"length");if(!Number.isSafeInteger(length)||length<0||length>limit||Reflect.ownKeys(value).length!==length+1)fail("PRIVATE_PATH_REFUSED");return Object.freeze(Array.from({length},(_unused,index)=>own(value,String(index))));}catch{fail("PRIVATE_PATH_REFUSED");}};
const same=(a,b)=>a.dev===b.dev&&a.ino===b.ino&&a.birthtimeMs===b.birthtimeMs;
const clean=path=>typeof path==="string"&&win32.isAbsolute(path)&&/^[A-Za-z]:\\/.test(path)&&!/[~\r\n\0]/.test(path);
const inside=(root,path)=>{const relative=win32.relative(root,path);return relative===""||!relative.startsWith("..")&&!win32.isAbsolute(relative);};
async function ancestors(fs,path,directory=true){
 let current=path,first;
 while(true){const info=await fs.lstat(current);if(info.isSymbolicLink()||(current===path?!directory&&!info.isFile()||directory&&!info.isDirectory():!info.isDirectory()))fail("PRIVATE_PATH_REFUSED");first??=info;const parent=win32.dirname(current);if(parent===current)return first;current=parent;}
}

/** Original helper stdout EOF and child close0 are both mandatory. */
export async function provePrivateCaptureAcl(options,spawn=nativeSpawn,terminal=()=>{},timeoutMs=15000){
 let keys;try{keys=Reflect.ownKeys(options??{});}catch{fail("PRIVATE_PATH_REFUSED");}
 if(keys.length!==4||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>15000||typeof spawn!=="function"||typeof terminal!=="function")fail("PRIVATE_PATH_REFUSED");
 const path=own(options,"path"),parent=own(options,"parent"),kind=own(options,"kind"),systemRoot=own(options,"systemRoot");
 if(!clean(path)||!clean(parent)||!clean(systemRoot)||!["parent","directory","file"].includes(kind))fail("PRIVATE_PATH_REFUSED");
 let child,timer,bytes=0,line="",ended=false,firstFailure=null,resolveDone,rejectDone;
 const pending=new Promise((resolve,reject)=>{resolveDone=resolve;rejectDone=reject;});pending.catch(()=>{});
 const refuse=()=>{if(firstFailure)return;firstFailure=Error("PRIVATE_PATH_REFUSED");rejectDone(firstFailure);};
 const data=chunk=>{if(!(chunk instanceof Uint8Array))return refuse();bytes+=chunk.byteLength;if(bytes>128)return refuse();for(const byte of chunk){if(byte>127)return refuse();line+=String.fromCharCode(byte);}};
 const end=()=>{ended=true;};
 const close=code=>{terminal();if(code!==0||!ended)return refuse();try{const value=JSON.parse(line);if(Object.keys(value).length!==1||value.private!==true)return refuse();resolveDone(true);}catch{refuse();}};
 try{
  child=spawn(win32.join(systemRoot,"System32","WindowsPowerShell","v1.0","powershell.exe"),["-NoProfile","-NonInteractive","-EncodedCommand",Buffer.from(PRIVATE_CAPTURE_ACL,"utf16le").toString("base64")],{env:{SystemRoot:systemRoot,SC_CAPTURE_TARGET:path,SC_CAPTURE_PARENT:parent,SC_CAPTURE_KIND:kind},stdio:["ignore","pipe","pipe"],shell:false,windowsHide:true});
  child.on("error",refuse);child.on("close",close);child.stdout.on("data",data);child.stdout.on("end",end);child.stdout.on("error",refuse);child.stderr.on("error",refuse);child.stderr.resume();timer=setTimeout(refuse,timeoutMs);
  return await pending;
 }catch{fail("PRIVATE_PATH_REFUSED");}
 finally{clearTimeout(timer);if(firstFailure){try{child?.kill?.();}catch{/* No shutdown claim. */}}child?.removeListener?.("error",refuse);child?.removeListener?.("close",close);child?.stdout?.removeListener?.("data",data);child?.stdout?.removeListener?.("end",end);child?.stdout?.removeListener?.("error",refuse);child?.stderr?.removeListener?.("error",refuse);child?.on?.("error",()=>{});child?.stdout?.on?.("error",()=>{});child?.stderr?.on?.("error",()=>{});}
}

/** Optional ports are hermetic seams; production uses native fs/fixed helper. */
export async function createPrivateCaptureOutput(options,ports={}){
 const fields=["names","parentRoot","sourceRoots","syncRoots","systemRoot"];
 let keys;try{keys=Reflect.ownKeys(options??{});}catch{fail("PRIVATE_PATH_REFUSED");}if(keys.length!==fields.length)fail("PRIVATE_PATH_REFUSED");
 const selected=Object.fromEntries(fields.map(key=>[key,own(options,key)])),names=arraySnapshot(selected.names,5),sourceRoots=arraySnapshot(selected.sourceRoots,10),syncRoots=arraySnapshot(selected.syncRoots,10);
 if((ports.platform??process.platform)!=="win32"||names.length!==5||sourceRoots.length===0||new Set(names).size!==5||names.some(name=>typeof name!=="string"||!/^[a-zA-Z0-9.-]+$/.test(name)||name.includes(".."))||!clean(selected.parentRoot)||!clean(selected.systemRoot))fail("PRIVATE_PATH_REFUSED");
 for(const roots of[sourceRoots,syncRoots])if(roots.some(root=>!clean(root)||inside(root,selected.parentRoot)))fail("PRIVATE_PATH_REFUSED");
 const fs=ports.fs??nativeFs,selectedNames=Object.freeze([...names]),parent=win32.resolve(selected.parentRoot),directory=win32.join(parent,names[0]+"-private");
 const leases=new Map();let directoryLease=null,parentLease=null,closed=false,claimed=false,terminalKnown=true;
 const proof=async(path,kind,parentPath)=>{terminalKnown=false;const value=ports.proveAcl?await ports.proveAcl({path,kind,parent:parentPath,systemRoot:selected.systemRoot}):await provePrivateCaptureAcl({path,kind,parent:parentPath,systemRoot:selected.systemRoot},ports.spawn??nativeSpawn,()=>{terminalKnown=true;});if(ports.proveAcl)terminalKnown=true;if(value!==true)fail("PRIVATE_PATH_REFUSED");};
 const validateParent=async()=>{const current=await ancestors(fs,parent);if(parentLease&&!same(current,parentLease))fail("PRIVATE_PATH_REFUSED");parentLease??=current;const canonical=await fs.realpath(parent);if(canonical.toLowerCase()!==parent.toLowerCase())fail("PRIVATE_PATH_REFUSED");};
 const validateDirectory=async()=>{if(!directoryLease||!same(directoryLease,await ancestors(fs,directory)))fail("PRIVATE_PATH_REFUSED");await validateParent();};
 const ensure=async values=>{try{
  if(closed||!Array.isArray(values)||values.length!==5||values.some((name,index)=>name!==selectedNames[index]))fail("PRIVATE_PATH_REFUSED");await validateParent();
  if(directoryLease){await validateDirectory();if(claimed||leases.size)fail("OUTPUT_EXISTS");return;}
  try{await fs.lstat(directory);fail("OUTPUT_EXISTS");}catch(error){if(dataValue(error,"code")!=="ENOENT")throw error;}
 }catch(error){fail(dataValue(error,"message")==="OUTPUT_EXISTS"?"OUTPUT_EXISTS":"PRIVATE_PATH_REFUSED");}};
 const write=async(name,data,settings)=>{
  let handle;
  try{
   if(closed||!selectedNames.includes(name)||typeof data!=="string"||Buffer.byteLength(data)>20*1024*1024||Reflect.ownKeys(settings??{}).length!==2||own(settings,"flag")!=="wx"||own(settings,"mode")!==0o600||!claimed&&name!==selectedNames[0])fail("PRIVATE_WRITE_REFUSED");
   await validateParent();
   if(!directoryLease){await proof(parent,"parent",parent);await validateParent();await fs.mkdir(directory,{mode:0o700});directoryLease=await ancestors(fs,directory);await proof(directory,"directory",parent);await validateDirectory();}
   await validateDirectory();const path=win32.join(directory,name);
   handle=await fs.open(path,"wx",0o600);const lease=await handle.stat();if(!lease.isFile())fail("PRIVATE_WRITE_REFUSED");leases.set(path,lease);
   await proof(path,"file",directory);await validateDirectory();if(!same(lease,await ancestors(fs,path,false)))fail("PRIVATE_WRITE_REFUSED");
   await handle.writeFile(data);await handle.sync();await handle.close();handle=null;
   if(!same(lease,await ancestors(fs,path,false)))fail("PRIVATE_WRITE_REFUSED");if(name===selectedNames[0])claimed=true;
  }catch(error){const code=dataValue(error,"message");fail(code==="OUTPUT_EXISTS"||code==="PRIVATE_PATH_REFUSED"?code:"PRIVATE_WRITE_REFUSED");}
  finally{if(handle)try{await handle.close();}catch{/* Original refusal preserved. */}}
 };
 return Object.freeze({ensure,write,async dispose(){if(closed)return;closed=true;if(!directoryLease||claimed||leases.size||!terminalKnown)return;try{await validateDirectory();if((await fs.readdir(directory)).length===0)await fs.rmdir(directory);}catch{/* Never delete replacements or unexpected entries. */}}});
}
