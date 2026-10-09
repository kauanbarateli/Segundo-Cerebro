import { readBackup, BackupError } from "./backup-format.mjs";
import { chmod, copyFile, mkdtemp, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { safeBackupDirectory } from "./backup-config.mjs";
/** Verify a private encrypted snapshot before any sink. Plaintext never touches disk. */
export async function restoreVerifiedBackup(path,key,sinks,options={}) {
 const temporaryRoot=await safeBackupDirectory(options.temporaryRoot??tmpdir(),{forbiddenRoots:options.forbiddenRoots,syncRoots:[process.env.OneDrive,process.env.OneDriveConsumer,process.env.OneDriveCommercial]});
 const directory = await mkdtemp(join(temporaryRoot,"sc-restore-cipher-")), snapshot = join(directory,"snapshot.scbackup"); let sink = null;
 try {
  await chmod(directory,0o700); await copyFile(path,snapshot,constants.COPYFILE_EXCL); await chmod(snapshot,0o600);
  const verified = await readBackup(snapshot,key);
  const restored = await readBackup(snapshot,key,{ async header(header) { await sinks.header?.(header); },async begin(metadata) { sink = await sinks.open(metadata); },async chunk(bytes) { if (!sink || typeof sink.write !== "function") throw new BackupError("RESTORE_SINK_REQUIRED"); await sink.write(bytes); },async end(summary,metadata) { await sink.close(summary,metadata); sink = null; } });
  if (JSON.stringify(verified) !== JSON.stringify(restored)) throw new BackupError("RESTORE_VERIFICATION_MISMATCH"); return restored;
 } catch (error) { await sink?.abort?.(); throw error; }
 finally { await rm(directory,{recursive:true,force:true}); }
}
