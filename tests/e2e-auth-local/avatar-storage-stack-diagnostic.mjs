import { types } from "node:util";

const BOUNDARIES = Object.freeze(["STACK_START", "STACK_STATUS", "STACK_DB_INSPECT", "STACK_KONG_INSPECT", "STACK_AUTH_INSPECT", "STACK_REST_INSPECT", "STACK_STORAGE_INSPECT"]);
const CODES = Object.freeze(["COMMAND_FAILED", "COMMAND_UNAVAILABLE", "COMMAND_TIMEOUT", "COMMAND_OUTPUT_LIMIT", "COMMAND_GROUP_UNCONFIRMED", "PROCESS_OPTIONS_REFUSED"]);
const observations = new WeakMap();
const isReference = value => value !== null && (typeof value === "object" || typeof value === "function");
const ownData = (value, key) => {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
};

/** Passive observation, never process authority or a main-report admission path.
 * Only own data descriptors are read; provider text and Proxy traps stay unused. */
export function createAvatarStackDiagnosticRecorder(report) {
  let observed = false;
  return Object.freeze({
    observe(boundary, error) {
      try {
        if (observed || !BOUNDARIES.includes(boundary) || !isReference(report) || types.isProxy(report)) return false;
        const sourceSha = ownData(report, "sourceSha");
        if (ownData(report, "scenario") !== "avatar-storage-local-ci" || ownData(report, "phase") !== "stack" || typeof sourceSha !== "string" || !/^[a-f0-9]{40}$/.test(sourceSha)) return false;
        let code = "UNKNOWN", groupConfirmed = null;
        if (isReference(error) && !types.isProxy(error)) {
          const candidate = ownData(error, "code"), group = ownData(error, "groupConfirmed");
          if (typeof candidate === "string" && CODES.includes(candidate)) code = candidate;
          if (typeof group === "boolean") groupConfirmed = group;
        }
        observations.set(report, Object.freeze({ schemaVersion: 1, scenario: "avatar-storage-stack-process-failure", sourceSha, boundary, code, groupConfirmed }));
        observed = true;
        return true;
      } catch { return false; }
    },
  });
}

/** Exact-reference provenance, consumed before the optional writer runs.
 * A clone, JSON lookalike or provider object cannot supply a companion. */
export function emitAvatarStackDiagnostic(report, output) {
  try {
    const value = observations.get(report);
    observations.delete(report);
    if (!value || typeof output !== "function") return false;
    output(value);
    return true;
  } catch { return false; }
}
