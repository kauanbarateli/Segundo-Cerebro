import { blankAdminBrowserCase, validateAdminBrowserCase, type AdminBrowserCase, type AdminBrowserKind, type AdminQuiescenceDetail } from "../e2e-auth-local/admin-browser-contract.mjs";
import { createAdminBrowserHarness, createAdminBrowserState, type AdminBrowserContext } from "../e2e-auth-local/admin-browser-support.mjs";
const kind:AdminBrowserKind="BLOCK_LIVE_BROWSER";
const report:AdminBrowserCase=validateAdminBrowserCase(blankAdminBrowserCase(kind));
const state=createAdminBrowserState(kind);state.count("adminRpc");
state.count("ownSessionsRpc");state.count("ownSessionsViews");state.count("ownSessionsReloads");
// @ts-expect-error No arbitrary counter fields.
state.count("password");
// @ts-expect-error No production/master or credential report field.
void report.password;
// @ts-expect-error No third scenario.
blankAdminBrowserCase("ADMIN_UI");
declare const c:AdminBrowserContext;
void createAdminBrowserHarness(c,{query:async()=>({}),write:async()=>{},cleanupAllowed:()=>false});
// @ts-expect-error Mandatory caller-owned fixed SQL and cleanup boundary.
void createAdminBrowserHarness(c,{transport:fetch});
// @ts-expect-error Readonly context prevents changing source ownership.
c.sourceSha="a".repeat(40);
import type { AdminOwnSessionsView } from "../e2e-auth-local/admin-browser-support.mjs";
declare const own:AdminOwnSessionsView;
// @ts-expect-error The browser proof projection cannot carry session IDs.
void own.sessions[0]!.id;
// @ts-expect-error Registered expiry is withheld from the client.
void own.sessions[0]!.notAfter;
void report;

const detail:AdminQuiescenceDetail={phase:"after-stop",pathClass:"login",resource:"document",frame:"main",stopAck:"owned-page"};
state.value.quiescenceDetail=detail;
// @ts-expect-error Observation has no raw URL field.
void detail.url;
// @ts-expect-error HTTP status is not a frame observation.
const invalidFrame:AdminQuiescenceDetail["frame"]=200;
void invalidFrame;
