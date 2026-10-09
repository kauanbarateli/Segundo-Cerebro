#!/usr/bin/env node
import { createHash, randomBytes } from "node:crypto";
import { open, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PERSONAL_REF } from "./backup-config.mjs";
import { MAX_PACKET_BYTES, acceptanceConfiguration, assertAcceptanceOperator, assertPrivatePermissions, privateAcceptanceDirectory, readPrivateAcceptanceManifest, RestoreAcceptanceError } from "./restore-acceptance-config.mjs";
import { readRestoredAcceptance } from "./restore-acceptance-reader.mjs";
import { startRestoreInspector } from "./restore-inspector/server.mjs";

const FIELDS=["SC_RESTORE_ACCEPT_EXECUTE","SC_RESTORE_ACCEPT_ISOLATED","SC_RESTORE_ACCEPT_CONFIRM_PROJECT","SC_RESTORE_ACCEPT_CONFIRM_USER","SC_RESTORE_ACCEPT_SUPABASE_URL","SC_RESTORE_ACCEPT_MANAGEMENT_PAT","SC_RESTORE_ACCEPT_PUBLISHABLE_KEY","SC_RESTORE_ACCEPT_STORAGE_KEY","SC_RESTORE_ACCEPT_AUTH_EMAIL","SC_RESTORE_ACCEPT_AUTH_PASSWORD","SC_RESTORE_ACCEPT_PSQL","SC_RESTORE_ACCEPT_PGHOST","SC_RESTORE_ACCEPT_PGPORT","SC_RESTORE_ACCEPT_PGDATABASE","SC_RESTORE_ACCEPT_PGUSER","SC_RESTORE_ACCEPT_PGPASSWORD","SC_RESTORE_ACCEPT_PGSSLMODE","SC_RESTORE_ACCEPT_PGSSLROOTCERT","SC_RESTORE_ACCEPT_OUTPUT_DIRECTORY"];
export async function runRestoreAcceptance(argv,environment,output=value=>process.stdout.write(JSON.stringify(value)+"\n"),dependencies={}) {
 try {
  if(argv.length===0||(argv.length===1&&argv[0]==="--help")){output({tool:"private-restore-acceptance",commands:["prepare","execute ABSOLUTE_PRIVATE_MANIFEST","inspect"],default:"no network",remote:"explicit local operator only",domain:"read only",auth_exception:"new fixture login and local logout only",secrets:"process environment only; never .env files, argv, output or packet"});return 0;}
  if(argv.length===1&&argv[0]==="prepare"){output({ok:true,operation:"prepare",network:false,required_environment:FIELDS,manifest_template:{version:1,source_project_ref:PERSONAL_REF,target_project_ref:"DISPOSABLE_PERSONAL_REF",personal_organization_id:"APPROVED_PERSONAL_ORGANIZATION_ID",archive_sha256:"VERIFIED_ORIGINAL_ARCHIVE_SHA256",fixture_user_id:"ORIGINAL_FIXTURE_UUID",vault_item_ids:["ORIGINAL_FIXTURE_ITEM_UUID"],files:[{id:"ORIGINAL_FIXTURE_FILE_UUID",kind:"drive",sha256:"ORIGINAL_FILE_SHA256",bytes:"ORIGINAL_FILE_SIZE"}]},next:"Create this manifest privately before executing. Provider organization checks remain mandatory."});return 0;}
  assertAcceptanceOperator(environment);
  if(argv.length===1&&argv[0]==="inspect") {
   const inspector=await(dependencies.inspector??startRestoreInspector)();output({ok:true,operation:"offline_inspector",url:inspector.url,network:"loopback static assets only",packet_uploads:false});
   if(dependencies.inspector)return 0;await new Promise(resolve=>{const stop=()=>void inspector.close().then(resolve);process.once("SIGINT",stop);process.once("SIGTERM",stop);});return 0;
  }
  if(argv.length!==2||argv[0]!=="execute")throw new RestoreAcceptanceError("INVALID_ACCEPTANCE_ARGUMENTS");
  const manifest=await readPrivateAcceptanceManifest(argv[1],environment,dependencies),config=acceptanceConfiguration(environment,manifest),directory=await privateAcceptanceDirectory(config.outputDirectory,environment,dependencies);
  const packet=await readRestoredAcceptance(config,manifest,dependencies),bytes=Buffer.from(JSON.stringify(packet)),name="restore-packet-"+new Date().toISOString().replace(/[:.]/g,"-")+"-"+randomBytes(4).toString("hex")+".json",path=join(directory,name);if(bytes.length>MAX_PACKET_BYTES)throw new RestoreAcceptanceError("ACCEPTANCE_PACKET_LIMIT");let created=false;
  try{const file=await open(path,"wx",0o600);created=true;try{await file.writeFile(bytes);await file.sync();}finally{await file.close();}await(dependencies.assertPrivate??assertPrivatePermissions)(path);}catch(error){if(created)await unlink(path).catch(()=>undefined);throw error;}
  output({ok:true,operation:"restore_acceptance_export",packet_name:name,packet_sha256:createHash("sha256").update(bytes).digest("hex"),fixture_auth_verified:true,local_logout_confirmed:true,files_verified:packet.files_verified,vault_items:packet.vault.items.length,domain_readonly:true,crypto:"pending_offline_inspector_password_and_original_kit",release:"does_not_certify_app_channels_rls_managed_owners_or_real_restore"});return 0;
 }catch(error){output({ok:false,operation:"restore_acceptance",error:error instanceof RestoreAcceptanceError?error.code:"ACCEPTANCE_UNAVAILABLE"});return 1;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.exitCode=await runRestoreAcceptance(process.argv.slice(2),process.env);
