#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PERSONAL_REF, REPO_ROOT, postgresEnvironment, safeBackupDirectory } from "./backup-config.mjs";
import { BackupError } from "./backup-format.mjs";
import { queryPostgres } from "./postgres-process.mjs";
export function assertReleaseReport(value) {
 if(!value||value.version!==1||typeof value.ok!=="boolean"||!Number.isSafeInteger(value.checks)||value.checks<1||value.checks>100000||!Array.isArray(value.deviations)||value.deviations.length>10000||Object.keys(value).sort().join(",")!=="checks,deviations,ok,version"||value.ok!==(value.deviations.length===0)||value.deviations.some(item=>!item||Object.keys(item).sort().join(",")!=="check,object"||typeof item.check!=="string"||!/^[a-z_]{1,60}$/.test(item.check)||typeof item.object!=="string"||item.object.length>300||/[\r\n\x00-\x1f]/.test(item.object)))throw new BackupError("INVALID_CATALOGUE_REPORT");return value;
}
export async function runReleaseCli(argv,env,output=value=>process.stdout.write(JSON.stringify(value)+"\n"),dependencies={}) {
 if(argv.length===0||argv[0]==="--help"){output({tool:"release-catalogue",command:"check",readonly:true,source_project:PERSONAL_REF,report:"metadata only, outside repository/work/sync/serving roots"});return 0;}
 try{
  if(argv.length!==1||argv[0]!=="check")throw new BackupError("INVALID_ARGUMENTS");if(!isAbsolute(env.SC_RELEASE_PSQL??""))throw new BackupError("PSQL_ABSOLUTE_EXECUTABLE_REQUIRED");
  const pg=postgresEnvironment(env),destination=await safeBackupDirectory(env.SC_RELEASE_REPORT_DIRECTORY,{forbiddenRoots:[env.SC_BACKUP_APP_SERVING_ROOT,env.SC_BACKUP_WORK_ROOT].filter(Boolean),syncRoots:[env.OneDrive,env.OneDriveConsumer,env.OneDriveCommercial].filter(Boolean)});
  const report=assertReleaseReport(await (dependencies.query??(request=>queryPostgres(env.SC_RELEASE_PSQL,pg,request,dependencies.spawn)))({file:resolve(REPO_ROOT,"supabase/tests/release-catalog.sql")}));
  const stamp=new Date().toISOString(),name="release-catalog-"+stamp.replace(/[:.]/g,"-")+"-"+randomBytes(4).toString("hex")+".json";
  await writeFile(resolve(destination,name),JSON.stringify({created_at:stamp,project_ref:PERSONAL_REF,operation:"readonly_release_catalogue",...report},null,2)+"\n",{flag:"wx",mode:0o600});
  output({ok:report.ok,operation:"release_catalogue",checks:report.checks,deviation_count:report.deviations.length,report_name:name});return report.ok?0:1;
 }catch(error){output({ok:false,operation:"release_catalogue",error:error instanceof BackupError?error.code:"CATALOGUE_UNAVAILABLE"});return 1;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.exitCode=await runReleaseCli(process.argv.slice(2),process.env);
