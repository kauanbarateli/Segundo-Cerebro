#!/usr/bin/env node
import { createHash, randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { backupConfiguration, encryptionSettings, PERSONAL_REF } from "./backup-config.mjs";
import { backupEntries } from "./backup-sources.mjs";
import { readBackup, writeBackup, BackupError } from "./backup-format.mjs";
import { restoreVerifiedBackup } from "./restore-verify.mjs";
import { isolatedRestoreSinks, restoreConfiguration } from "./restore-target.mjs";
async function archiveHash(path) { const digest = createHash("sha256"); for await (const bytes of createReadStream(path)) digest.update(bytes); return digest.digest("hex"); }
export async function runBackupCli(argv,env,output = value => process.stdout.write(JSON.stringify(value) + "\n"),dependencies = {}) {
 if (argv[0] === "--help" || argv.length === 0) { output({ tool:"personal-encrypted-backup",commands:["create","verify ABSOLUTE_ARCHIVE","restore ABSOLUTE_ARCHIVE"],secrets:"environment only",restore:"separate explicitly confirmed empty project; read manual runbook first",remote_run:"explicit operator only" }); return 0; }
 try {
  if (argv[0] === "create" && argv.length === 1) {
   const config = await backupConfiguration(env), stamp = new Date().toISOString(), filename = "second-brain-" + stamp.replace(/[:.]/g,"-") + "-" + randomBytes(4).toString("hex") + ".scbackup", destination = resolve(config.destination,filename);
   const result = await writeBackup(destination,config.key,{project_ref:PERSONAL_REF,key_id:config.keyId,created_at:stamp},backupEntries(config,dependencies)); const checked = await readBackup(destination,config.key); if (JSON.stringify(result) !== JSON.stringify(checked)) throw new BackupError("POST_WRITE_VERIFICATION_FAILED");
   const report={ ok:true,operation:"encrypted_backup",archive_name:filename,...checked,archive_sha256:await archiveHash(destination),key_id:config.keyId };await writeFile(destination+".report.json",JSON.stringify(report)+"\n",{flag:"wx",mode:0o600});output(report); return 0;
  }
  if (argv[0] === "verify" && argv.length === 2 && isAbsolute(argv[1])) { const {key,keyId} = encryptionSettings(env), result = await readBackup(resolve(argv[1]),key,{header(header) { if (header.key_id !== keyId || header.project_ref !== PERSONAL_REF) throw new BackupError("BACKUP_IDENTITY_MISMATCH"); }}); output({ok:true,operation:"verify",...result,archive_sha256:await archiveHash(resolve(argv[1])),key_id:keyId}); return 0; }
  if (argv[0] === "restore" && argv.length === 2 && isAbsolute(argv[1])) { const {key,keyId}=encryptionSettings(env),config=restoreConfiguration(env),sinks=isolatedRestoreSinks(config,dependencies);const result=await restoreVerifiedBackup(resolve(argv[1]),key,{...sinks,async header(header){if(header.key_id!==keyId||header.project_ref!==PERSONAL_REF)throw new BackupError("BACKUP_IDENTITY_MISMATCH");await sinks.header();}},{forbiddenRoots:[env.SC_BACKUP_APP_SERVING_ROOT,env.SC_BACKUP_WORK_ROOT].filter(Boolean)});const proof=await sinks.complete();output({ok:true,operation:"isolated_restore",...result,...proof,key_id:keyId,release_required:"manual_managed_owners_auth_login_and_vault_unlock"});return 0; }
  throw new BackupError("INVALID_ARGUMENTS");
 } catch (error) { output({ok:false,operation:"backup",error:error instanceof BackupError ? error.code : "BACKUP_UNAVAILABLE"}); return 1; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = await runBackupCli(process.argv.slice(2),process.env);
