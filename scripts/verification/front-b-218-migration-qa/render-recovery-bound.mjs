// Offline preparation only. Output is still blocked by both fatal guards.
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const PIN='7b51eb4ea9b12deed1a969efdfc9368bd494ce2247af495f004c2cf6a92ac84c';
const fail=()=>{throw Error('RECOVERY_BIND_REFUSED');};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const replaceOnce=(text,needle,replacement)=>{if(text.split(needle).length!==2)fail();return text.replace(needle,()=>replacement);};
function validVersion(v){
 if(typeof v!=='string'||!/^\d{14}$/.test(v)||v<='20261101235120')return false;
 const year=Number(v.slice(0,4)),month=Number(v.slice(4,6)),day=Number(v.slice(6,8)),hour=Number(v.slice(8,10)),minute=Number(v.slice(10,12)),second=Number(v.slice(12,14));
 const d=new Date(Date.UTC(year,month-1,day,hour,minute,second));
 return year>=2000&&d.getUTCFullYear()===year&&d.getUTCMonth()===month-1&&d.getUTCDate()===day&&d.getUTCHours()===hour&&d.getUTCMinutes()===minute&&d.getUTCSeconds()===second;
}
export function renderBoundRecovery(source,version,name){
 if(!Buffer.isBuffer(source)||sha(source)!==PIN||!validVersion(version)||typeof name!=='string'||!/^[a-z0-9_]{1,63}$/.test(name))fail();
 let text=source.toString('utf8');if(!Buffer.from(text).equals(source))fail();
 const manual="DO $manual_guard$ BEGIN RAISE EXCEPTION 'STOP: cancellation not qualified or authorized'; END $manual_guard$;";
 const external="DO $external_guard$ BEGIN RAISE EXCEPTION 'STOP: writers and safe recovery not proven'; END $external_guard$;";
 if(text.split(manual).length!==2||text.split(external).length!==2)fail();
 text=replaceOnce(text,"actual_quarantine_version constant text := '__QA_QUARANTINE_VERSION_PENDING__';",`actual_quarantine_version constant text := '${version}';`);
 text=replaceOnce(text,"actual_quarantine_name constant text := '__QA_QUARANTINE_NAME_PENDING__';",`actual_quarantine_name constant text := '${name}';`);
 if(text.split(manual).length!==2||text.split(external).length!==2||!text.includes("actual_quarantine_name = '__QA_QUARANTINE_NAME_PENDING__'"))fail();
 const sql=Buffer.from(text);return Object.freeze({sql,sha256:sha(sql),guarded:true});
}
export async function main(argv=process.argv.slice(2)){
 if(argv.length!==4||argv[0]!=='--version'||argv[2]!=='--name')fail();
 const source=await readFile(new URL('./cancel-quarantine-218-ledger-bound.guarded.sql.txt',import.meta.url));
 const result=renderBoundRecovery(source,argv[1],argv[3]);
 process.stdout.write(result.sql);
 process.stderr.write(JSON.stringify({code:'RECOVERY_STILL_GUARDED',sha256:result.sha256})+'\n');
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){main().catch(()=>{process.stderr.write('RECOVERY_BIND_REFUSED\n');process.exitCode=1;});}
