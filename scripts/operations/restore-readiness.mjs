#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { BackupError } from "./backup-format.mjs";
import { queryPostgres } from "./postgres-process.mjs";
import { restoreConfiguration, EMPTY_TARGET_SQL, MANAGED_OWNER_PREFLIGHT_SQL, assertManagedOwnerPreflight } from "./restore-target.mjs";

const fields = ["version", "serverVersionNum", "sameActor", "isSuperuser", "schemas", "schemaOwnerAvailable", "schemaOwnerUnavailable", "tables", "tableOwnerAvailable", "tableOwnerUnavailable", "tableDropOwnerOrSchemaAvailable", "tableDropOwnerOrSchemaUnavailable"];
const errors = new Set(["INVALID_ARGUMENTS", "ISOLATED_RESTORE_TARGET_REQUIRED", "ISOLATED_STORAGE_CONFIGURATION_REQUIRED", "RESTORE_ABSOLUTE_EXECUTABLES_REQUIRED", "RESTORE_TARGET_NOT_EMPTY", "RESTORE_MANAGED_OWNER_REPORT_INVALID", "RESTORE_MANAGED_OWNER_PRIVILEGES_REQUIRED", "PSQL_UNAVAILABLE", "PSQL_FAILED", "PSQL_TIMEOUT", "PSQL_OUTPUT_LIMIT", "PSQL_INVALID_REPORT"]);
const failure = code => { throw new BackupError(code); };
function emptyTarget(report) {
  if (!report || typeof report !== "object" || Array.isArray(report)) failure("PSQL_INVALID_REPORT");
  const descriptors = Object.getOwnPropertyDescriptors(report);
  if (Reflect.ownKeys(descriptors).length !== 1 || !descriptors.empty?.enumerable || !Object.hasOwn(descriptors.empty, "value") || typeof descriptors.empty.value !== "boolean") failure("PSQL_INVALID_REPORT");
  return descriptors.empty.value;
}
function ownerSnapshot(report) {
  if (!report || typeof report !== "object" || Array.isArray(report)) failure("RESTORE_MANAGED_OWNER_REPORT_INVALID");
  const descriptors = Object.getOwnPropertyDescriptors(report);
  if (Reflect.ownKeys(descriptors).length !== fields.length || Reflect.ownKeys(descriptors).some(field => !fields.includes(field))) failure("RESTORE_MANAGED_OWNER_REPORT_INVALID");
  const snapshot = {};
  for (const field of fields) {
    if (!descriptors[field]?.enumerable || !Object.hasOwn(descriptors[field], "value")) failure("RESTORE_MANAGED_OWNER_REPORT_INVALID");
    snapshot[field] = descriptors[field].value;
  }
  // Only the canonical privilege refusal may accompany validated public metadata.
  try { assertManagedOwnerPreflight(snapshot); }
  catch (error) { if (!(error instanceof BackupError) || error.code !== "RESTORE_MANAGED_OWNER_PRIVILEGES_REQUIRED") throw error; }
  return snapshot;
}

/** Fixed read-only projection only: never opens an archive, restores or uses HTTP. */
export async function runRestoreReadiness(argv, env, output = value => process.stdout.write(JSON.stringify(value) + "\n"), dependencies = {}) {
  const report = { ok: false, operation: "restore_preflight", error: null, targetEmpty: null, managedOwners: null, archiveRead: false, remoteMutation: false, restoreAccepted: false, historicalCauseEstablished: false };
  try {
    if (argv.length !== 1 || argv[0] !== "restore-preflight") failure("INVALID_ARGUMENTS");
    const config = restoreConfiguration(env);
    const query = dependencies.query ?? ((request, options) => queryPostgres(config.psql, config.pg, request, dependencies.spawn, options));
    report.targetEmpty = emptyTarget(await query({ sql: EMPTY_TARGET_SQL }, { timeoutMs: 15000 }));
    if (!report.targetEmpty) failure("RESTORE_TARGET_NOT_EMPTY");
    report.managedOwners = ownerSnapshot(await query({ sql: MANAGED_OWNER_PREFLIGHT_SQL }, { timeoutMs: 15000 }));
    assertManagedOwnerPreflight(report.managedOwners);
    report.ok = true;
  } catch (error) {
    report.error = error instanceof BackupError && errors.has(error.code) ? error.code : "RESTORE_PREFLIGHT_UNAVAILABLE";
  }
  output(report);
  return report.ok ? 0 : 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = await runRestoreReadiness(process.argv.slice(2), process.env);
