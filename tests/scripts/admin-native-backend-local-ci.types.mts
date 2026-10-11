import { runAdminLocalCase, type AdminLocalContext, type AdminLocalOptions } from "../e2e-auth-local/admin-native-backend-local-case.mjs";
import { validateAdminLocalCiReport, type AdminLocalCiReport, type AdminLocalCaseReport, type AdminLocalPortFailure } from "../e2e-auth-local/admin-native-backend-local-ci-contract.mjs";
import { createAdminNativeBackendAcceptance, type AdminNativeSqlRequest } from "../e2e-auth-local/admin-native-backend-case.mjs";
const context: AdminLocalContext = { ci: true, githubActions: true, localAdminRun: true, supabaseUrl: "http://127.0.0.1:54321", case: "CREATE_FORCED", sourceSha: "", namespace: "", systemIdentifier: "", publishableKey: "", serverSecretKey: "", commitmentSecret: "" };
const options: AdminLocalOptions = { transport: async () => new Response(), registerActors: async actors => { const id: string = actors.a.id; void id; }, inspectSql: async (request: AdminNativeSqlRequest) => { const target: string | null = request.targetId; const operation: string | null = request.operationId; void target; void operation; throw new Error("TYPE_ONLY"); }, retainedSql: async () => true, cleanupAllowed: () => false, createAcceptance: createAdminNativeBackendAcceptance };
const result: Promise<AdminLocalCaseReport> = runAdminLocalCase(context, options); void result;
const envelope: AdminLocalCiReport = validateAdminLocalCiReport({});
const packetProvenance: "protocol-only" | undefined = envelope.packet?.provenance; void packetProvenance;
const portFailure: AdminLocalPortFailure | null | undefined = envelope.cases[0]?.portFailure; void portFailure;
// @ts-expect-error Port diagnostics cannot select an arbitrary target.
const foreignPort: AdminLocalPortFailure = { port: 54323, operation: "listen", errorClass: "other" }; void foreignPort;
// @ts-expect-error The diagnostic never carries a raw provider error.
const rawPortError: AdminLocalPortFailure = { port: 54321, operation: "listen", errorClass: "EADDRINUSE", message: "private" }; void rawPortError;
// @ts-expect-error This runner cannot attest either browser literal.
const claim: true = envelope.limitations.browserContextsVerified; void claim;
// @ts-expect-error Auth setup cannot target the personal hosted project.
const hosted: AdminLocalContext = { ...context, supabaseUrl: "https://example.invalid" }; void hosted;
