import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// An in-memory .mts is compiled explicitly with noEmit. Never execute it or
// instantiate its declared actors; there is no fixture file or emitted program.
const SOURCE = String.raw`
import { createIdentityRlsAcceptance, RLS_LOCAL_API, RLS_LOCAL_APP, type IdentityRlsContext, type IdentityRlsActor, type IdentityRlsTransport, type IdentityRlsRequestInit } from "../e2e-auth-local/identity-rls-support.mjs";
import { createEventAppendOnlyAcceptance, type EventAppendOnlyTransport, type EventAppendOnlyRequestInit } from "../e2e-auth-local/events-append-only-support.mjs";
import { assembleIdentityRlsPacket, validateIdentityRlsPacket, assembleEventsPacket, validateEventsPacket, validateIdentityAuthReport, type IdentityRlsBefore, type IdentityRlsAfter, type IdentityRlsPacket, type EventAppendOnlyReport, type EventsPacket, type IdentityAuthReport, type IdentityAuthFailurePoint } from "../e2e-auth-local/identity-data-api-contract.mjs";
declare const a: IdentityRlsActor;
declare const b: IdentityRlsActor;
declare const transport: IdentityRlsTransport;
declare const eventsTransport: EventAppendOnlyTransport;
const runtime = { ci:true, githubActions:true, localAuthRun:true, appUrl:RLS_LOCAL_APP, supabaseUrl:RLS_LOCAL_API } as const;
const context = {runtime,publishableKey:"compile-only synthetic placeholder",a,b} satisfies IdentityRlsContext;
const rls = createIdentityRlsAcceptance(context,{transport,timeoutMs:100});
const events = createEventAppendOnlyAcceptance(context,{transport:eventsTransport,clientId:"compile-only UUID placeholder"});
const before:Promise<IdentityRlsBefore> = rls.before();
const after:Promise<IdentityRlsAfter> = rls.after();
const event:Promise<EventAppendOnlyReport> = events.run();
async function bridge():Promise<readonly [IdentityRlsPacket,EventsPacket]> {
 const observedBefore = await before;
 const observedAfter = observedBefore.status === "passed" ? await after : null;
 const observedEvent = await event;
 return [validateIdentityRlsPacket(assembleIdentityRlsPacket({before:observedBefore,after:observedAfter,writeOutcomeUncertain:rls.metadata().writeOutcomeUncertain})), validateEventsPacket(assembleEventsPacket({report:observedEvent,writeOutcomeUncertain:events.metadata().writeOutcomeUncertain}))];
}
const validated:IdentityAuthReport = validateIdentityAuthReport({});
const ownScenario:"identity-data-api" = validated.scenario;
const ownPoint:IdentityAuthFailurePoint = "IDENTITY_RLS_AFTER";
declare const rlsInit:IdentityRlsRequestInit;
declare const eventsInit:EventAppendOnlyRequestInit;
const strictRedirect:"error" = eventsInit.redirect;
const method:"GET"|"POST"|"PATCH"|"DELETE" = eventsInit.method;
// @ts-expect-error No default transport.
createIdentityRlsAcceptance(context);
// @ts-expect-error No explicit transport.
createIdentityRlsAcceptance(context,{});
// @ts-expect-error Client marker is not a transport.
createEventAppendOnlyAcceptance(context,{clientId:"placeholder"});
// @ts-expect-error Caller must supply one client UUID.
createEventAppendOnlyAcceptance(context,{transport:eventsTransport});
// @ts-expect-error CI opt-in cannot be disabled.
createIdentityRlsAcceptance({...context,runtime:{...runtime,localAuthRun:false}},{transport});
// @ts-expect-error Remote endpoints are not in the API.
createEventAppendOnlyAcceptance({...context,runtime:{...runtime,supabaseUrl:"https://remote.invalid"}},{transport:eventsTransport,clientId:"placeholder"});
// @ts-expect-error Actor UUID is required.
createIdentityRlsAcceptance({...context,a:{accessToken:a.accessToken,sessionId:a.sessionId,expiresAt:a.expiresAt}},{transport});
// @ts-expect-error Actor session binding is required.
createEventAppendOnlyAcceptance({...context,b:{id:b.id,accessToken:b.accessToken,expiresAt:b.expiresAt}},{transport:eventsTransport,clientId:"placeholder"});
// @ts-expect-error Expiry is integer milliseconds at runtime, numeric at types.
createIdentityRlsAcceptance({...context,a:{...a,expiresAt:"later"}},{transport});
// @ts-expect-error No SQL/endpoint/owner override exists.
createEventAppendOnlyAcceptance(context,{transport:eventsTransport,clientId:"placeholder",sql:"synthetic"});
// @ts-expect-error Phase types are distinct.
const misplaced:Promise<IdentityRlsAfter> = before;
// @ts-expect-error Before is required, including explicit null.
assembleIdentityRlsPacket({after:null,writeOutcomeUncertain:false});
// @ts-expect-error Caller sticky bit is required.
assembleEventsPacket({report:null});
// @ts-expect-error A password packet is not this standalone scenario.
const wrongScenario:IdentityRlsPacket = {schemaVersion:1,scenario:"password-change",status:"not-run",code:"DEPENDENCY_NOT_RUN",failurePhase:null,before:null,after:null,writeOutcomeUncertain:false};
// @ts-expect-error Password point cannot be an identity Auth point.
const wrongPoint:IdentityAuthFailurePoint = "POST_REQUEST_ABORTED";
// @ts-expect-error Reports do not expose actor data.
validated.accessToken;
// @ts-expect-error Metadata cannot clear caller sticky bits.
events.metadata().writeOutcomeUncertain = false;
// @ts-expect-error No redirect fallback.
const redirected:EventAppendOnlyRequestInit = {...eventsInit,redirect:"follow"};
// @ts-expect-error RLS does not offer DELETE.
const deletion:IdentityRlsRequestInit = {...rlsInit,method:"DELETE"};
void [bridge,ownScenario,ownPoint,strictRedirect,method,misplaced,wrongScenario,wrongPoint,redirected,deletion];
`;
const filename = fileURLToPath(new URL("./__identity-data-api-compile-only.mts", import.meta.url)).replaceAll("\\", "/");
function diagnostics(source) {
  const options = { noEmit: true, strict: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, types: ["node"] };
  const host = ts.createCompilerHost(options), getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (path, languageVersion, onError, shouldCreateNewSourceFile) => path === filename ? ts.createSourceFile(filename, source, languageVersion, true) : getSourceFile(path, languageVersion, onError, shouldCreateNewSourceFile);
  const program = ts.createProgram([filename], options, host);
  return ts.getPreEmitDiagnostics(program).map(diagnostic => ({ code: diagnostic.code, message: ts.flattenDiagnosticMessageText(diagnostic.messageText, " ") }));
}
test("explicit compile-only declaration graph preserves helper pins/required actor and independent scenario types", () => {
  assert.deepEqual(diagnostics(SOURCE), []);
});
test("type gate rejects a genuine omitted transport without an expected-error directive", () => {
  const invalid = SOURCE + "\ncreateIdentityRlsAcceptance(context, {});\n";
  const result = diagnostics(invalid);
  assert.equal(result.length, 1); assert.equal(result[0].code, 2345);
});
