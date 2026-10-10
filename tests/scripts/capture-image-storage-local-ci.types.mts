import type { NativeCaseOptions, NativeCaseSetup, VerifiedLocalActors } from "../e2e-auth-local/capture-image-storage-local-case.mjs";
import type { StorageLocalCiReport, StorageLocalCaseReport } from "../e2e-auth-local/capture-image-storage-local-ci-contract.mjs";
import type { CaptureImageSqlProof, CaptureImageObjectsProof } from "../e2e-auth-local/capture-image-storage-support.mjs";
const setup: NativeCaseSetup={ci:true,githubActions:true,localAuthRun:true,appUrl:"http://127.0.0.1:3117",supabaseUrl:"http://127.0.0.1:54321",publishableKey:"synthetic",serverSecretKey:"synthetic"};
declare const proof: CaptureImageSqlProof;
declare const objects: CaptureImageObjectsProof;
const options: NativeCaseOptions={transport:fetch,inspectSql:async ids=>{void ids.ownerId;return proof;},inspectObjects:async request=>{void request.query;return objects;},registerActors:(actors:VerifiedLocalActors)=>{void actors.b.sessionId;},cleanupAllowed:()=>true};
// @ts-expect-error caller-owned SQL inspector is mandatory
const missing: NativeCaseOptions={transport:fetch,registerActors:()=>{},cleanupAllowed:()=>true};
// @ts-expect-error no hosted origin accepted by the native setup type
const hosted: NativeCaseSetup={...setup,supabaseUrl:"https://foreign.test"};
declare const outer: StorageLocalCiReport;
declare const inner: StorageLocalCaseReport;
// @ts-expect-error reports are readonly
outer.writeOutcomeUncertain=false;
// @ts-expect-error verified binding is readonly
options.registerActors=()=>{};
// @ts-expect-error no provenance promotion field exists
void inner.nativeVerified;
void [setup,options,missing,hosted,outer,inner];
