// Pure outer-envelope, namespace and fixed-query controls. No stack is started.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { requireStorageCi, storageInspectionInput, acceptStorageInspection, createStorageSqlInspector, verifyStorageInstance, acceptStorageAbsence, acceptStorageContainer, decodeOneSqlRow, main } from "../../scripts/verification/capture-image-storage-local-ci.mjs";
import { STORAGE_LOCAL_CI_CHECKS, STORAGE_LOCAL_CASE_CHECKS, STORAGE_LOCAL_SDK_VERSIONS, validateStorageLocalCiReport, validateStorageLocalCaseReport } from "../e2e-auth-local/capture-image-storage-local-ci-contract.mjs";
import { CAPTURE_IMAGE_STAGES, CAPTURE_IMAGE_CHECKS, CAPTURE_IMAGE_PASS_COUNTS, CAPTURE_IMAGE_CLEANUP_STAGES, CAPTURE_IMAGE_CLEANUP_PASS_COUNTS } from "../e2e-auth-local/capture-image-storage-support.mjs";
import { assembleCaptureImageStoragePacket } from "../e2e-auth-local/capture-image-storage-contract.mjs";
const id=n=>"58000000-0000-4000-8000-"+String(n).padStart(12,"0");
const actors={a:{id:id(1),sessionId:id(2),marker:"a".repeat(64)},b:{id:id(3),sessionId:id(4),marker:"b".repeat(64)}};
const instance=()=>({owner:"postgres",database:"postgres",version:170006,systemId:"1234567890123456789"});
const packet=()=>assembleCaptureImageStoragePacket({pipeline:{schemaVersion:1,scenario:"capture-image-storage",status:"passed",code:"PASSED",failurePoint:null,stages:CAPTURE_IMAGE_STAGES.map(name=>({name,passed:true})),counts:{...CAPTURE_IMAGE_PASS_COUNTS},checks:Object.fromEntries(CAPTURE_IMAGE_CHECKS.map(k=>[k,true])),measurements:{sourceBytes:1021,finalBytes:287,sourceWidth:60,sourceHeight:40,finalWidth:40,finalHeight:60},writeOutcomeUncertain:false},cleanup:{schemaVersion:1,scenario:"capture-image-storage-cleanup",status:"passed",code:"PASSED",failurePoint:null,stages:CAPTURE_IMAGE_CLEANUP_STAGES.map(name=>({name,passed:true})),counts:{...CAPTURE_IMAGE_CLEANUP_PASS_COUNTS},exactInventory:true,objectsAbsent:true,authDeletionAllowed:true,writeOutcomeUncertain:false},writeOutcomeUncertain:false});
const caseReport=()=>({schemaVersion:1,scenario:"capture-image-storage-local-case",status:"passed",code:"PASSED",phase:"complete",cleanupFailurePoint:null,counts:{authRequests:16,fixtureCreated:2,fixtureDeleted:2,sessionsVerified:2},checks:Object.fromEntries(STORAGE_LOCAL_CASE_CHECKS.map(k=>[k,true])),captureImage:packet(),writeOutcomeUncertain:false});
const passed=()=>({schemaVersion:1,scenario:"capture-image-storage-local-ci",status:"passed",code:"PASSED",phase:"complete",cleanupStage:"complete",cliVersion:"2.120.0",sourceSha:"a".repeat(40),sourceHashes:[{path:"package-lock.json",sha256:"b".repeat(64),bytes:100},...Array.from({length:39},(_,i)=>({path:`src/fixture-${i}.ts`,sha256:"b".repeat(64),bytes:100}))],sdkVersions:{...STORAGE_LOCAL_SDK_VERSIONS},migrations:17,migrationsApplied:17,catalogueChecks:1246,checks:Object.fromEntries(STORAGE_LOCAL_CI_CHECKS.map(k=>[k,true])),caseReport:caseReport(),writeOutcomeUncertain:false});
const refused=fn=>assert.throws(fn,{message:"STORAGE_LOCAL_REPORT_REFUSED"});
test("dedicated runner needs both opt-ins, Linux CI and sterile environment",()=>{
  const env={CI:"true",GITHUB_ACTIONS:"true",SC_AUTH_LOCAL_CI_RUN:"1",SC_CAPTURE_IMAGE_LOCAL_CI_RUN:"1",RUNNER_TEMP:resolve("/tmp/owned-ci")};assert.equal(requireStorageCi(env,"linux").runnerTemp,env.RUNNER_TEMP);for(const bad of [{...env,SC_CAPTURE_IMAGE_LOCAL_CI_RUN:"0"},{...env,SC_AUTH_LOCAL_CI_RUN:"0"},{...env,SUPABASE_SECRET_KEY:"synthetic-foreign"}])assert.throws(()=>requireStorageCi(bad,"linux"));assert.throws(()=>requireStorageCi(env,"win32"));
});
test("fixed SQL takes exactly three UUIDs bound to the verified B and refuses arbitrary SQL or foreign IDs",()=>{
  const ids={ownerId:actors.b.id,uploadId:id(5),captureId:id(6)},sql=storageInspectionInput(ids,actors);assert.ok(sql.includes("begin read only;"));assert.ok(sql.endsWith("rollback;"));assert.ok(sql.includes("statement_timeout='10s'"));assert.ok(sql.includes("\\set sc_b "+actors.b.id));assert.equal(sql.includes("delete from"),false);
  for(const bad of [{...ids,sql:"select *"},{...ids,ownerId:actors.a.id},{...ids,uploadId:actors.a.id},{...ids,captureId:ids.uploadId},{...ids,uploadId:"x';delete from auth.users;--"}])assert.throws(()=>storageInspectionInput(bad,actors),{message:"LOCAL_SQL_REFUSED"});assert.throws(()=>storageInspectionInput(ids,{...actors,b:{...actors.b,marker:"invalid"}}),{message:"LOCAL_SQL_REFUSED"});
});
test("PG17 instance, native SID/marker proof and later absence must remain the same owned database",()=>{
  const proof={file:{},capture:{},links:[],events:[],receipts:[]};assert.equal(acceptStorageInspection({provenance:{...instance(),actorsBound:true},proof},instance().systemId),proof);
  for(const mutate of [v=>{v.version=160000;},v=>{v.systemId="different";},v=>{v.owner="service_role";},v=>{v.database="other";}]){const v=instance();mutate(v);assert.throws(()=>verifyStorageInstance(v,instance().systemId));}
  assert.throws(()=>acceptStorageInspection({provenance:{...instance(),actorsBound:false},proof},instance().systemId),{message:"LOCAL_SQL_REFUSED"});assert.throws(()=>acceptStorageInspection({provenance:{...instance(),actorsBound:true},proof:{...proof,sql:"select *"}},instance().systemId),{message:"LOCAL_SQL_REFUSED"});
  const absent={...instance(),authEmpty:true,objectsEmpty:true,domainEmpty:true};assert.equal(acceptStorageAbsence(absent,instance().systemId),true);for(const field of ["authEmpty","objectsEmpty","domainEmpty"])assert.throws(()=>acceptStorageAbsence({...absent,[field]:false},instance().systemId),{message:"DOMAIN_ABSENCE_REFUSED"});
});
test("a late read-only query cannot certify SQL or enable reentry after its caller closes",async()=>{
  let release,calls=0,allowed=true;const frame={provenance:{...instance(),actorsBound:true},proof:{file:{},capture:{},links:[],events:[],receipts:[]}};
  const inspector=createStorageSqlInspector({actors,systemId:instance().systemId,allowed:()=>allowed,query:async sql=>{calls++;assert.ok(sql.includes("begin read only;"));return new Promise(resolve=>{release=resolve;});}});
  const running=inspector.inspect({ownerId:actors.b.id,uploadId:id(5),captureId:id(6)});assert.equal(inspector.metadata().running,true);allowed=false;inspector.close();release(frame);await assert.rejects(running,{message:"LOCAL_SQL_REFUSED"});assert.deepEqual(inspector.metadata(),{running:false,completed:false,closed:true});await assert.rejects(inspector.inspect({ownerId:actors.b.id,uploadId:id(5),captureId:id(6)}),{message:"LOCAL_SQL_REFUSED"});assert.equal(calls,1);
});
test("container projection binds the exact project, native local DB port and live resource IDs",()=>{
  const project="sc-auth-ci-"+"a".repeat(24),v={id:"b".repeat(64),name:"/supabase_db_"+project,label:project,running:true,imageId:"sha256:"+"c".repeat(64),ports:{"5432/tcp":[{HostIp:"127.0.0.1",HostPort:"54322"}]}};assert.equal(acceptStorageContainer(v,project,"db"),v.id);
  for(const bad of [{...v,label:"other"},{...v,name:"/other"},{...v,running:false},{...v,ports:{"5432/tcp":[{HostIp:"127.0.0.1",HostPort:"5432"}]}}])assert.throws(()=>acceptStorageContainer(bad,project,"db"),{message:"LOCAL_NAMESPACE_REFUSED"});
});
test("standalone envelope requires all external gates and cannot inherit protocol or schema4 PASS",()=>{
  const value=validateStorageLocalCiReport(passed());assert.equal(value.scenario,"capture-image-storage-local-ci");assert.equal(Object.isFrozen(value.caseReport.captureImage),true);
  for(const key of STORAGE_LOCAL_CI_CHECKS){const report=passed();report.checks[key]=false;refused(()=>validateStorageLocalCiReport(report));}
  for(const mutate of [v=>{v.schemaVersion=4;},v=>{v.caseReport=null;},v=>{v.nativeVerified=true;},v=>{v.writeOutcomeUncertain=true;},v=>{v.migrationsApplied=16;},v=>{v.sourceHashes=[];},v=>{v.sdkVersions['@supabase/storage-js']='changed';},v=>{v.catalogueChecks=1243;}]){const v=passed();mutate(v);refused(()=>validateStorageLocalCiReport(v));}
});
test("case cleanup and ordinary actor proofs cannot be forged by a media protocol packet",()=>{
  for(const key of STORAGE_LOCAL_CASE_CHECKS){const v=caseReport();v.checks[key]=false;refused(()=>validateStorageLocalCaseReport(v));}
  const v=caseReport();v.counts.authRequests=15;refused(()=>validateStorageLocalCaseReport(v));v.counts.authRequests=16;v.captureImage=null;refused(()=>validateStorageLocalCaseReport(v));
});
test("metadata refuses secrets, accessors, arbitrary codes and multirow SQL output",()=>{
  const v=passed();v.token="synthetic-private-token";refused(()=>validateStorageLocalCiReport(v));const getter=passed();let reads=0;Object.defineProperty(getter,"checks",{enumerable:true,get(){reads++;throw new Error("private");}});refused(()=>validateStorageLocalCiReport(getter));assert.equal(reads,0);const bad=passed();bad.code="provider-message";refused(()=>validateStorageLocalCiReport(bad));assert.throws(()=>decodeOneSqlRow('{}\n{}'),{message:"LOCAL_SQL_REFUSED"});assert.deepEqual(decodeOneSqlRow('{"ok":true}\n'),{ok:true});
});
test("source manifest rejects sparse/accessor rows and extra symbols without reading a getter",()=>{
  let reads=0;for(const mutate of [v=>{delete v.sourceHashes[0];},v=>{Object.defineProperty(v.sourceHashes,'0',{enumerable:true,get(){reads++;return {};}});},v=>{v.sourceHashes[Symbol('secret')]='private';},v=>{Object.setPrototypeOf(v.sourceHashes,{});},v=>{v.sourceHashes[0].path='../outside';}]){const v=passed();mutate(v);refused(()=>validateStorageLocalCiReport(v));}assert.equal(reads,0);
});
test("help and invalid CLI arguments start no service and return only closed metadata",async()=>{
  const output=[];assert.equal(await main(["--help"],{},v=>output.push(v)),0);assert.equal(output[0].code,"NO_SERVICE_STARTED");assert.equal(output[0].hostedAccess,false);assert.equal(await main(["--other"],{},v=>output.push(v)),1);
  const source=await readFile(new URL('../../scripts/verification/capture-image-storage-local-ci.mjs',import.meta.url),'utf8');assert.equal(/supabase\s+(?:login|link)|\.env\.local|console\.(?:log|error)/.test(source),false);assert.ok(source.includes('capture:false'));
});
