#!/usr/bin/env node
import { createHash, randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { open, lstat, unlink } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { backupConfiguration, encryptionSettings, PERSONAL_REF } from "./backup-config.mjs";
import { backupEntries, assertBackupEntriesCurrent } from "./backup-sources.mjs";
import { readBackup, writeBackup, BackupError } from "./backup-format.mjs";
import { restoreVerifiedBackup } from "./restore-verify.mjs";
import { isolatedRestoreSinks, restoreConfiguration } from "./restore-target.mjs";
async function archiveHash(path) { const digest = createHash("sha256"); for await (const bytes of createReadStream(path)) digest.update(bytes); return digest.digest("hex"); }
// Only remove a report created by this invocation, never an archive or a
// preexisting report. Keep a lease and compare inode/device plus a regular path.
async function removeOwnReport(path,identity) {
 if(!path||!identity)return;
 let lease;
 try {
  const before=await lstat(path,{bigint:true});
  if(!before.isFile()||before.isSymbolicLink()||before.dev!==identity.dev||before.ino!==identity.ino)throw new BackupError("BACKUP_REPORT_CLEANUP_FAILED");
  lease=await open(path,"r");
  const current=await lease.stat({bigint:true}),after=await lstat(path,{bigint:true});
  if(!current.isFile()||!after.isFile()||after.isSymbolicLink()||current.dev!==identity.dev||current.ino!==identity.ino||after.dev!==current.dev||after.ino!==current.ino)throw new BackupError("BACKUP_REPORT_CLEANUP_FAILED");
  await unlink(path);
 } catch(error){if(error?.code!=="ENOENT")throw error;}
 finally {await lease?.close();}
}
export async function runBackupCli(argv,env,output = value => process.stdout.write(JSON.stringify(value) + "\n"),dependencies = {}) {
 if (argv[0] === "--help" || argv.length === 0) { output({ tool:"personal-encrypted-backup",commands:["create","verify ABSOLUTE_ARCHIVE","restore ABSOLUTE_ARCHIVE"],secrets:"environment only",restore:"separate explicitly confirmed empty project; read manual runbook first",remote_run:"explicit operator only" }); return 0; }
 try {
  if (argv[0] === "create" && argv.length === 1) {
   const config=await backupConfiguration(env),stamp=new Date().toISOString(),filename="second-brain-"+stamp.replace(/[:.]/g,"-")+"-"+randomBytes(4).toString("hex")+".scbackup",destination=resolve(config.destination,filename),entries=backupEntries(config,dependencies);
   let reportFile=null,reportPath=null,reportIdentity=null,reportOwned=false;
   try {
    const result=await writeBackup(destination,config.key,{project_ref:PERSONAL_REF,key_id:config.keyId,created_at:stamp},entries);assertBackupEntriesCurrent(entries);
    const checked=await readBackup(destination,config.key);assertBackupEntriesCurrent(entries);
    if(JSON.stringify(result)!==JSON.stringify(checked))throw new BackupError("POST_WRITE_VERIFICATION_FAILED");
    const archiveSha256=await archiveHash(destination);assertBackupEntriesCurrent(entries);
    const report={ok:true,operation:"encrypted_backup",archive_name:filename,...checked,archive_sha256:archiveSha256,key_id:config.keyId};
    reportPath=destination+".report.json";
    reportFile=await open(reportPath,"wx+",0o600);reportOwned=true;assertBackupEntriesCurrent(entries);
    reportIdentity=await reportFile.stat({bigint:true});assertBackupEntriesCurrent(entries);
    await reportFile.writeFile(JSON.stringify(report)+"\n");assertBackupEntriesCurrent(entries);
    await reportFile.sync();assertBackupEntriesCurrent(entries);
    // Exclusive creation, not atomic publication. A successful create plus
    // separate verify is required; a visible partial report never certifies it.
    await reportFile.close();reportFile=null;assertBackupEntriesCurrent(entries);
    output(report);return 0;
   } catch(error) {
    if(reportOwned&&!reportIdentity&&reportFile){try{reportIdentity=await reportFile.stat({bigint:true});}catch{/* Unknown identity: leave the unqualified artifact. */}}
    try{await reportFile?.close();}catch{/* Preserve the original closed failure. */}
    if(reportOwned){try{await removeOwnReport(reportPath,reportIdentity);}catch{/* Never delete the archive or another inode. */}}
    throw error;
   }
  }
  if (argv[0] === "verify" && argv.length === 2 && isAbsolute(argv[1])) { const {key,keyId} = encryptionSettings(env), result = await readBackup(resolve(argv[1]),key,{header(header) { if (header.key_id !== keyId || header.project_ref !== PERSONAL_REF) throw new BackupError("BACKUP_IDENTITY_MISMATCH"); }}); output({ok:true,operation:"verify",...result,archive_sha256:await archiveHash(resolve(argv[1])),key_id:keyId}); return 0; }
  if (argv[0] === "restore" && argv.length === 2 && isAbsolute(argv[1])) { const {key,keyId}=encryptionSettings(env),config=restoreConfiguration(env),sinks=isolatedRestoreSinks(config,dependencies);const result=await restoreVerifiedBackup(resolve(argv[1]),key,{...sinks,async header(header){if(header.key_id!==keyId||header.project_ref!==PERSONAL_REF)throw new BackupError("BACKUP_IDENTITY_MISMATCH");await sinks.header();}},{forbiddenRoots:[env.SC_BACKUP_APP_SERVING_ROOT,env.SC_BACKUP_WORK_ROOT].filter(Boolean)});const proof=await sinks.complete();output({ok:true,operation:"isolated_restore",...result,...proof,key_id:keyId,release_required:"manual_managed_owners_auth_login_and_vault_unlock"});return 0; }
  throw new BackupError("INVALID_ARGUMENTS");
 } catch (error) { output({ok:false,operation:"backup",error:error instanceof BackupError ? error.code : "BACKUP_UNAVAILABLE"}); return 1; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = await runBackupCli(process.argv.slice(2),process.env);
