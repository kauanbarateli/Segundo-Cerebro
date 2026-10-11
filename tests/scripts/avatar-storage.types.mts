import { createAvatarStorageCase, createAvatarRequestGate, type AvatarContext, type AvatarPorts, type AvatarRequest } from "../e2e-auth-local/avatar-storage-local-case.mjs";
import { validateAvatarStorageReport, type AvatarStorageReport } from "../e2e-auth-local/avatar-storage-contract.mjs";
declare const context: AvatarContext;
declare const ports: AvatarPorts;
function compileOnly() {
  const checked: AvatarStorageReport = validateAvatarStorageReport({});
  void createAvatarStorageCase(context, ports);
  // @ts-expect-error a remote origin cannot be a local case endpoint
  void createAvatarStorageCase({ ...context, supabaseUrl: "https://example.invalid" }, ports);
  // @ts-expect-error the local case needs its own explicit opt-in
  void createAvatarStorageCase({ ...context, localAvatarRun: false }, ports);
  // @ts-expect-error pending inspections are not optional capability ports
  void createAvatarStorageCase(context, { transport: fetch, cleanupAllowed: () => true });
  const request: AvatarRequest = { category: "storageRequests", method: "PUT", url: "http://127.0.0.1:54321/", write: true, capability: true };
  const gate = createAvatarRequestGate(context, fetch);
  void gate.request(request, async () => new Response(null));
  // @ts-expect-error the gate permits only the four declared counters
  void gate.request({ ...request, category: "otherRequests" }, async () => new Response());
  // @ts-expect-error positive limitations are not part of the Avatar report
  checked.limitations.hostedSupabase = true;
}
void compileOnly;
