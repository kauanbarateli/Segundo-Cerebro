import {
  validateAdminNativeReport, validateAdminNativeCleanup, assembleAdminNativePacket,
  type AdminNativeReport, type AdminNativeCleanup, type AdminNativePacket,
} from "../e2e-auth-local/admin-native-backend-contract.mjs";
import type { AdminNativeAcceptance, AdminNativeOptions, AdminNativeContext, AdminNativeSqlInspector } from "../e2e-auth-local/admin-native-backend-case.mjs";

// Compile-only contracts. This function is never invoked and asserts neither
// IO nor native provenance. The unknown runtime inputs still need validation.
export function adminNativeTypeContract(acceptance: AdminNativeAcceptance, options: AdminNativeOptions, context: AdminNativeContext, inspector: AdminNativeSqlInspector, value: unknown) {
  const report: AdminNativeReport = validateAdminNativeReport(value);
  const cleanup: AdminNativeCleanup = validateAdminNativeCleanup(value);
  const packet: AdminNativePacket = assembleAdminNativePacket({ sourceSha: context.sourceSha, cases: [{ case: context.case, report, cleanup, namespaceCleanup: "not-run" }], writeOutcomeUncertain: false });
  const results: readonly [Promise<AdminNativeReport>, Promise<AdminNativeCleanup>] = [acceptance.run(), acceptance.cleanupAuth()];
  void [results, packet, options.transport, options.inspectSql, inspector, acceptance.metadata().writeOutcomeUncertain];
  if (report.status === "passed") { const terminal: true = report.terminalKnown; const unknown: false = report.writeOutcomeUncertain; void [terminal, unknown]; }
  if (cleanup.status === "passed") { const absent: true = cleanup.accountsAbsent; const retained: true = cleanup.retainedAdminMetadataExact; void [absent, retained]; }
  // @ts-expect-error An inspector cannot receive arbitrary SQL.
  void inspector({ sql: "select arbitrary" });
  // @ts-expect-error Transport/SQL authority cannot be omitted.
  const incomplete: AdminNativeOptions = {};
  // @ts-expect-error A native claim is not part of the closed protocol.
  void report.nativeVerified;
  void incomplete;
}
