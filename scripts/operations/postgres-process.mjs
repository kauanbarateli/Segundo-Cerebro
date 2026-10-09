import { spawn } from "node:child_process";
import { BackupError } from "./backup-format.mjs";
/** No connection string or secret enters argv, stderr, or a returned error. */
export async function queryPostgres(executable,env,request,spawnProcess = spawn) {
 const args = ["--no-psqlrc","--quiet","--tuples-only","--no-align","--set=ON_ERROR_STOP=1",request.file ? "--file=" + request.file : "--command=" + request.sql];
 const child = spawnProcess(executable,args,{env,stdio:["ignore","pipe","pipe"],shell:false,windowsHide:true}); let bytes=0; const chunks=[];
 child.stderr?.resume();
 const ended = new Promise((resolve,reject) => {child.on("error",()=>reject(new BackupError("PSQL_UNAVAILABLE")));child.on("close",code=>{if(code===0)resolve();else reject(new BackupError("PSQL_FAILED"));});}); ended.catch(()=>undefined);
 try { if(!child.stdout)throw new BackupError("PSQL_UNAVAILABLE");for await(const chunk of child.stdout){bytes+=chunk.length;if(bytes>1048576)throw new BackupError("PSQL_OUTPUT_LIMIT");chunks.push(Buffer.from(chunk));}await ended;return JSON.parse(Buffer.concat(chunks).toString("utf8").trim()); }
 catch(error){child.kill();if(error instanceof BackupError)throw error;throw new BackupError("PSQL_INVALID_REPORT");}
}
