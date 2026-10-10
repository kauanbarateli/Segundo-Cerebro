import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative } from "node:path";
import { AUTH_IDENTITY_REPORT_FILE, IDENTITY_RLS_PACKET_FILE, EVENT_PACKET_FILE, validateIdentityAuthReport, validateIdentityRlsPacket, validateEventsPacket } from "./identity-data-api-contract.mjs";
import { CAPTURE_TASK_PACKET_FILE, validateCaptureTaskPacket } from "./capture-task-persistence-contract.mjs";

const fail = () => { throw new Error("REPORT_WRITE_FAILED"); };
const LIMIT = 16_384;

/** Validate every component before any file is created. No provider material is
 * accepted, and filenames come only from the closed internal contract. */
export function serializeIdentityReports(reports) {
  try {
    if (!reports || Object.getPrototypeOf(reports) !== Object.prototype ||
        Reflect.ownKeys(reports).length !== 4 || !["auth", "identityRls", "events", "captureTask"].every(key => Object.hasOwn(reports, key) && Object.hasOwn(Object.getOwnPropertyDescriptor(reports, key), "value"))) fail();
    const projections = [validateIdentityAuthReport(reports.auth), validateIdentityRlsPacket(reports.identityRls), validateEventsPacket(reports.events), validateCaptureTaskPacket(reports.captureTask)];
    const names = [AUTH_IDENTITY_REPORT_FILE, IDENTITY_RLS_PACKET_FILE, EVENT_PACKET_FILE, CAPTURE_TASK_PACKET_FILE];
    return projections.map((projection, index) => {
      const bytes = Buffer.from(JSON.stringify(projection) + "\n", "utf8");
      if (bytes.length > LIMIT) fail();
      return Object.freeze({ name: names[index], bytes });
    });
  } catch { fail(); }
}

export function isPrivateReportDirectory(root, directory, requested, information) {
  if (typeof root !== "string" || typeof directory !== "string" || typeof requested !== "string") return false;
  const child = relative(root, directory);
  return !!child && child !== ".." && !child.startsWith(".." + (process.platform === "win32" ? "\\" : "/")) &&
    !isAbsolute(child) && isAbsolute(root) && isAbsolute(directory) && directory === requested &&
    information.isDirectory() && !information.isSymbolicLink() && (information.mode & 0o077) === 0;
}

/** Exclusive writes in the runner's canonical 0700 case directory. A partial
 * filesystem failure stays a process failure; it never overwrites or rolls back
 * an earlier component or claims that server-side cleanup happened. */
export async function writeIdentityReports(environment, reports) {
  const packets = serializeIdentityReports(reports);
  if (!environment || typeof environment.reportPath !== "string" || basename(environment.reportPath) !== AUTH_IDENTITY_REPORT_FILE) fail();
  try {
    const requested = dirname(environment.reportPath);
    const information = await lstat(requested);
    const root = await realpath(environment.runnerTemp), directory = await realpath(requested);
    if (!isPrivateReportDirectory(root, directory, requested, information)) fail();
    for (const packet of packets) {
      const file = await open(join(directory, packet.name), constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
      try { await file.writeFile(packet.bytes); await file.sync(); }
      finally { await file.close(); }
    }
  } catch { fail(); }
}
