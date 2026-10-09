import { mkdir, lstat } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { BackupError } from "./backup-format.mjs";
export const PERSONAL_REF = "rishenjoikgmfubmnfiu";
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)),"../..");
export const WORK_ROOT = resolve(REPO_ROOT,"..");
const fail = code => { throw new BackupError(code); };
const inside = (target,root) => { const path = relative(root.toLowerCase(),target.toLowerCase()); return path === "" || path !== ".." && !path.startsWith(".." + sep) && !isAbsolute(path); };
async function canonical(path) {
 // Fail closed on every symlink/junction ancestor rather than following it into serving/sync roots.
 let current = path;
 while (true) { try { if ((await lstat(current)).isSymbolicLink()) fail("UNSAFE_BACKUP_DESTINATION"); } catch (error) { if (error.code !== "ENOENT") throw error; } const parent = dirname(current); if (parent === current) return resolve(path); current = parent; }
}
export async function safeBackupDirectory(value, options = {}) {
 if (typeof value !== "string" || !isAbsolute(value) || value.includes("~") || value.startsWith("\\\\") || /(^|[\\/])onedrive(?:[^\\/]*)([\\/]|$)/i.test(value)) fail("UNSAFE_BACKUP_DESTINATION");
 const roots = [REPO_ROOT,WORK_ROOT,...(options.forbiddenRoots ?? []),...(options.syncRoots ?? [])].filter(Boolean), requested = resolve(value); if (roots.some(root => inside(requested,resolve(root)))) fail("UNSAFE_BACKUP_DESTINATION");
 const target = await canonical(requested);
 if (roots.some(root => inside(target,resolve(root)))) fail("UNSAFE_BACKUP_DESTINATION");
 await mkdir(target,{ recursive:true,mode:0o700 }); const final = await canonical(target); if (roots.some(root => inside(final,resolve(root)))) fail("UNSAFE_BACKUP_DESTINATION"); return final;
}
export function encryptionSettings(env) {
 const key = env.SC_BACKUP_ENCRYPTION_KEY, keyId = env.SC_BACKUP_KEY_ID;
 if (typeof key !== "string" || Buffer.from(key,"base64").length !== 32 || Buffer.from(key,"base64").toString("base64") !== key || new Set(Buffer.from(key,"base64")).size < 8 || typeof keyId !== "string" || !/^[a-zA-Z0-9_-]{1,50}$/.test(keyId)) fail("BACKUP_KEY_REQUIRED");
 if (["AUTH_RATE_LIMIT_SECRET","AUTH_STATE_SECRET","ADMIN_COMMAND_SECRET","GOOGLE_TOKEN_ENCRYPTION_KEY","GOOGLE_CALENDAR_TOKEN_KEY","GOOGLE_CALENDAR_STATE_SECRET","GOOGLE_OAUTH_CLIENT_SECRET","CRON_SECRET","GOOGLE_CALENDAR_CRON_SECRET","SUPABASE_SECRET_KEY","SC_BACKUP_SUPABASE_KEY"].some(name => env[name] === key)) fail("BACKUP_KEY_MUST_BE_INDEPENDENT");
 return { key,keyId };
}
export function postgresEnvironment(env,projectRef = PERSONAL_REF) {
 const host = env.PGHOST, user = env.PGUSER;
 if (!(host === "db." + projectRef + ".supabase.co" && user === "postgres" || typeof host === "string" && /^[a-z0-9-]+[.]pooler[.]supabase[.]com$/.test(host) && user === "postgres." + projectRef) || env.PGDATABASE !== "postgres" || !env.PGPASSWORD || !["verify-full","require"].includes(env.PGSSLMODE) || env.PGPORT && (!/^[0-9]{1,5}$/.test(env.PGPORT) || +env.PGPORT < 1 || +env.PGPORT > 65535)) fail("PERSONAL_POSTGRES_CONFIGURATION_REQUIRED");
 const child = {}; for (const name of ["PATH","SystemRoot","TEMP","TMP","HOME","PGHOST","PGPORT","PGDATABASE","PGUSER","PGPASSWORD","PGSSLMODE","PGSSLROOTCERT"]) if (env[name]) child[name] = env[name]; return child;
}
export async function backupConfiguration(env) {
 const {key,keyId} = encryptionSettings(env);
 if (env.SC_BACKUP_QUIESCED !== "YES") fail("QUIESCED_BACKUP_REQUIRED");
 if (env.SC_BACKUP_SUPABASE_URL !== "https://" + PERSONAL_REF + ".supabase.co" || !/^sb_secret_[A-Za-z0-9_-]+$/.test(env.SC_BACKUP_SUPABASE_KEY ?? "")) fail("PERSONAL_STORAGE_CONFIGURATION_REQUIRED");
 if (!env.SC_BACKUP_PG_DUMP || !isAbsolute(env.SC_BACKUP_PG_DUMP)) fail("PG_DUMP_ABSOLUTE_EXECUTABLE_REQUIRED");
 const destination = await safeBackupDirectory(env.SC_BACKUP_DESTINATION,{ forbiddenRoots:[env.SC_BACKUP_APP_SERVING_ROOT,env.SC_BACKUP_WORK_ROOT].filter(Boolean),syncRoots:[env.OneDrive,env.OneDriveConsumer,env.OneDriveCommercial].filter(Boolean) });
 return { key,keyId,destination,pgDump:env.SC_BACKUP_PG_DUMP,pg:postgresEnvironment(env),storageUrl:env.SC_BACKUP_SUPABASE_URL,storageKey:env.SC_BACKUP_SUPABASE_KEY };
}
