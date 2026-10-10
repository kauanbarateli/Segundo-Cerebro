// Pure outer-envelope, namespace and fixed-query controls. No stack is started.
import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql.ts";
import { resolve } from "node:path";
import { requireStorageCi, storageObjectsInput, acceptStorageObjectsInspection, createStorageObjectsInspector, storageInspectionInput, acceptStorageInspection, createStorageSqlInspector, verifyStorageInstance, acceptStorageAbsence, acceptStorageContainer, decodeOneSqlRow, main } from "../../scripts/verification/capture-image-storage-local-ci.mjs";
import { STORAGE_LOCAL_CI_CHECKS, STORAGE_LOCAL_CASE_CHECKS, STORAGE_LOCAL_SDK_VERSIONS, validateStorageLocalCiReport, validateStorageLocalCaseReport } from "../e2e-auth-local/capture-image-storage-local-ci-contract.mjs";
import { CAPTURE_IMAGE_STAGES, CAPTURE_IMAGE_CHECKS, CAPTURE_IMAGE_PASS_COUNTS, CAPTURE_IMAGE_CLEANUP_STAGES, CAPTURE_IMAGE_CLEANUP_PASS_COUNTS } from "../e2e-auth-local/capture-image-storage-support.mjs";
import { assembleCaptureImageStoragePacket } from "../e2e-auth-local/capture-image-storage-contract.mjs";
const id=n=>"58000000-0000-4000-8000-"+String(n).padStart(12,"0");
const actors={a:{id:id(1),sessionId:id(2),marker:"a".repeat(64)},b:{id:id(3),sessionId:id(4),marker:"b".repeat(64)}};
const instance=()=>({owner:"postgres",database:"postgres",version:170006,systemId:"1234567890123456789"});
const packet=()=>assembleCaptureImageStoragePacket({pipeline:{schemaVersion: 2,scenario:"capture-image-storage",status:"passed",code:"PASSED",failurePoint:null,stages:CAPTURE_IMAGE_STAGES.map(name=>({name,passed:true})),counts:{...CAPTURE_IMAGE_PASS_COUNTS},checks:Object.fromEntries(CAPTURE_IMAGE_CHECKS.map(k=>[k,true])),measurements:{sourceBytes:1021,finalBytes:287,sourceWidth:60,sourceHeight:40,finalWidth:40,finalHeight:60},writeOutcomeUncertain:false},cleanup:{schemaVersion: 2,scenario:"capture-image-storage-cleanup",status:"passed",code:"PASSED",failurePoint:null,stages:CAPTURE_IMAGE_CLEANUP_STAGES.map(name=>({name,passed:true})),counts:{...CAPTURE_IMAGE_CLEANUP_PASS_COUNTS},exactInventory:true,objectsAbsent:true,authDeletionAllowed:true,writeOutcomeUncertain:false},writeOutcomeUncertain:false});
const caseReport=()=>({schemaVersion: 2,scenario:"capture-image-storage-local-case",status:"passed",code:"PASSED",phase:"complete",cleanupFailurePoint:null,counts:{authRequests:16,fixtureCreated:2,fixtureDeleted:2,sessionsVerified:2},checks:Object.fromEntries(STORAGE_LOCAL_CASE_CHECKS.map(k=>[k,true])),captureImage:packet(),writeOutcomeUncertain:false});
const passed=()=>({schemaVersion: 2,scenario:"capture-image-storage-local-ci",status:"passed",code:"PASSED",phase:"complete",cleanupStage:"complete",cliVersion:"2.120.0",sourceSha:"a".repeat(40),sourceHashes:[{path:"package-lock.json",sha256:"b".repeat(64),bytes:100},...Array.from({length:39},(_,i)=>({path:`src/fixture-${i}.ts`,sha256:"b".repeat(64),bytes:100}))],sdkVersions:{...STORAGE_LOCAL_SDK_VERSIONS},migrations:17,migrationsApplied:17,catalogueChecks:1246,checks:Object.fromEntries(STORAGE_LOCAL_CI_CHECKS.map(k=>[k,true])),caseReport:caseReport(),writeOutcomeUncertain:false});
const refused=fn=>assert.throws(fn,{message:"STORAGE_LOCAL_REPORT_REFUSED"});
const marker=()=>({path:"node_modules/server-only/empty.js",sha256:"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",bytes:0});
// Synthetic failed metadata only: acceptance preserves a failure report, never
// establishes native services, object absence or a successful domain write.
const failedWithMarker=()=>({schemaVersion: 2,scenario:"capture-image-storage-local-ci",status:"failed",code:"SOURCE_REFUSED",phase:"sources",cleanupStage:"not-started",cliVersion:"2.120.0",sourceSha:"a".repeat(40),sourceHashes:[{path:"package-lock.json",sha256:"b".repeat(64),bytes:100},...Array.from({length:53},(_,i)=>({path:`src/fixture-${i}.ts`,sha256:"b".repeat(64),bytes:100})),marker()],sdkVersions:{...STORAGE_LOCAL_SDK_VERSIONS},migrations:17,migrationsApplied:0,catalogueChecks:0,checks:Object.fromEntries(STORAGE_LOCAL_CI_CHECKS.map(k=>[k,k==="localEnvironment"])),caseReport:null,writeOutcomeUncertain:false});
test("the official empty marker preserves a failed source envelope without promoting service provenance",()=>{
  const input=failedWithMarker(),value=validateStorageLocalCiReport(input);assert.equal(value.status,"failed");assert.equal(value.code,"SOURCE_REFUSED");assert.equal(value.sourceHashes.length,55);assert.deepEqual(value.sourceHashes.at(-1),marker());assert.equal(value.caseReport,null);assert.deepEqual(value.checks,input.checks);assert.equal(Object.isFrozen(value.sourceHashes.at(-1)),true);
  for(const replacement of [{...marker(),path:"node_modules/server-only/index.js"},{...marker(),path:"node_modules/server-only/package.json"},{...marker(),path:"node_modules/server-only-lookalike/empty.js"},{...marker(),path:"tests/empty.js"},{...marker(),sha256:"b".repeat(64)},{...marker(),bytes:1}]){const bad=failedWithMarker();bad.sourceHashes[54]=replacement;refused(()=>validateStorageLocalCiReport(bad));}
});
test("marker acceptance retains a failed native-case envelope and its sticky unknown latch through namespace cleanup",()=>{
  const input=failedWithMarker();input.code="CASE_FAILED";input.phase="native-case";input.cleanupStage="complete";input.migrationsApplied=17;input.catalogueChecks=1246;input.writeOutcomeUncertain=true;for(const key of ["sourcesConfirmed","ownedNamespace","pg17","instanceIdentityConfirmed","servicesNative","ownedNamespaceCleanup","stackCleanupConfirmed","privateDirectoriesRemoved"])input.checks[key]=true;
  input.caseReport={schemaVersion: 2,scenario:"capture-image-storage-local-case",status:"failed",code:"WRITE_OUTCOME_UNCERTAIN",phase:"fixture-create",cleanupFailurePoint:null,counts:{authRequests:2,fixtureCreated:1,fixtureDeleted:0,sessionsVerified:0},checks:Object.fromEntries(STORAGE_LOCAL_CASE_CHECKS.map(k=>[k,false])),captureImage:null,writeOutcomeUncertain:true};
  const value=validateStorageLocalCiReport(input);assert.equal(value.status,"failed");assert.equal(value.caseReport.status,"failed");assert.equal(value.writeOutcomeUncertain,true);assert.equal(value.caseReport.checks.authCleanupConfirmed,false);assert.equal(value.checks.stackCleanupConfirmed,true);assert.equal(value.checks.executionNatural,false);for(const key of ["domainAbsent","storageMetadataAbsent","authUsersAbsent"])assert.equal(value.checks[key],false);
  const cleared=structuredClone(input);cleared.writeOutcomeUncertain=false;refused(()=>validateStorageLocalCiReport(cleared));const absent=structuredClone(input);absent.checks.storageMetadataAbsent=true;refused(()=>validateStorageLocalCiReport(absent));const duplicate=structuredClone(input);duplicate.sourceHashes.push(marker());refused(()=>validateStorageLocalCiReport(duplicate));
});
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


test("schema2 outer and case reports reject historical schema1 including nested packets",()=>{
  const outer=passed();outer.schemaVersion=1;refused(()=>validateStorageLocalCiReport(outer));const inner=caseReport();inner.schemaVersion=1;refused(()=>validateStorageLocalCaseReport(inner));const nested=structuredClone(passed());nested.caseReport.captureImage.schemaVersion=1;refused(()=>validateStorageLocalCiReport(nested));
});
const objectRequest=query=>({query,ownerId:actors.b.id,uploadId:id(5)});
const objectProof=()=>({provenance:{...instance(),actorsBound:true},proof:{buckets:["second-brain-files","second-brain-staging"].map(id=>({id,name:id,public:false})),objects:[]}});
test("object SQL is fixed READ ONLY with owner/SID/marker and exactly two canonical buckets",()=>{
  const input=storageObjectsInput(objectRequest("FRESH_PATHS"),actors);assert.ok(input.includes("begin read only;"));assert.ok(input.includes("set local statement_timeout='10s'"));assert.ok(input.includes("set local lock_timeout='2s'"));assert.ok(input.endsWith("rollback;"));assert.ok(input.includes("from storage.objects"));assert.ok(input.includes("o.name=:'sc_b'||'/'||:'sc_upload'"));assert.ok(input.includes("auth.sessions"));assert.ok(input.includes("sc_capture_image_ci_marker"));assert.ok(input.includes(actors.a.marker));assert.ok(input.includes(actors.b.sessionId));
  for(const request of [{...objectRequest("FRESH_PATHS"),sql:"delete from storage.objects"},{...objectRequest("FRESH_PATHS"),ownerId:actors.a.id},{...objectRequest("FRESH_PATHS"),uploadId:actors.b.sessionId},objectRequest("arbitrary")])assert.throws(()=>storageObjectsInput(request,actors),{message:"LOCAL_SQL_REFUSED"});
  assert.deepEqual(acceptStorageObjectsInspection(objectProof(),instance().systemId,objectRequest("FRESH_PATHS")),objectProof().proof);
  for(const mutate of [v=>{v.provenance.systemId="999";},v=>{v.provenance.actorsBound=false;},v=>{v.provenance.version=160000;},v=>{v.proof.buckets[0].public=true;},v=>{v.proof.objects=[{id:id(6),bucket_id:"second-brain-staging",name:actors.a.id+"/"+id(5)}];}]){const v=objectProof();mutate(v);assert.throws(()=>acceptStorageObjectsInspection(v,instance().systemId,objectRequest("FRESH_PATHS")));}
});
test("object inspector has one ordered sequence, no retry, no rebinding and no late proof after close",async()=>{
  let calls=0;const inspector=createStorageObjectsInspector({actors,systemId:instance().systemId,query:async()=>{calls++;return objectProof();},allowed:()=>true});
  await assert.rejects(()=>inspector.inspect(objectRequest("STAGING_REMOVED")),/LOCAL_SQL_REFUSED/);assert.equal(calls,0);await inspector.inspect(objectRequest("FRESH_PATHS"));await assert.rejects(()=>inspector.inspect({...objectRequest("STAGING_REMOVED"),uploadId:id(8)}),/LOCAL_SQL_REFUSED/);assert.equal(calls,1);await inspector.inspect(objectRequest("STAGING_REMOVED"));await inspector.inspect(objectRequest("FINAL_REMOVED"));assert.equal(inspector.metadata().completed,true);assert.equal(calls,3);await assert.rejects(()=>inspector.inspect(objectRequest("FINAL_REMOVED")),/LOCAL_SQL_REFUSED/);assert.equal(calls,3);
  let release;const deferred=new Promise(resolve=>{release=resolve;});const late=createStorageObjectsInspector({actors,systemId:instance().systemId,query:async()=>{await deferred;return objectProof();},allowed:()=>true}),pending=late.inspect(objectRequest("FRESH_PATHS"));assert.equal(late.metadata().running,true);late.close();assert.equal(late.metadata().running,true);release();await assert.rejects(()=>pending,/LOCAL_SQL_REFUSED/);assert.equal(late.metadata().completed,false);assert.equal(late.metadata().running,false);await assert.rejects(()=>late.inspect(objectRequest("FRESH_PATHS")),/LOCAL_SQL_REFUSED/);
  let failedCalls=0;const failed=createStorageObjectsInspector({actors,systemId:instance().systemId,query:async()=>{failedCalls++;throw new Error("synthetic");},allowed:()=>true});await assert.rejects(()=>failed.inspect(objectRequest("FRESH_PATHS")));await assert.rejects(()=>failed.inspect(objectRequest("FRESH_PATHS")),/LOCAL_SQL_REFUSED/);assert.equal(failedCalls,1);
});


test("the original fixed object SQL reads canonical metadata and actor SIDs in disposable SQL",async()=>{
  const db=await createLocalCanonicalSql();try{
    for(const actor of [actors.a,actors.b]){await db.query("insert into auth.users(id,aud,role,email,raw_app_meta_data) values($1,'authenticated','authenticated',$2,$3::jsonb)",[actor.id,actor.id+"@example.invalid",JSON.stringify({sc_capture_image_ci_marker:actor.marker})]);await db.query("insert into auth.sessions(id,user_id) values($1,$2)",[actor.sessionId,actor.id]);}
    const request=objectRequest("FRESH_PATHS"),generated=storageObjectsInput(request,actors),variables=Object.fromEntries(generated.split("\n").filter(line=>line.startsWith("\\set ")).map(line=>{const[,name,value]=line.split(" ");return [name,value];}));
    // The one pg_control_system() leaf is a declared pure-test seam. We use
    // the original generated query and real metadata/SIDs; no PG17/native
    // namespace, GoTrue, HTTP or Storage bytes are established by this test.
    const sql=generated.replace(/^\\set .+\r?$/gm,"").replaceAll(/:'(sc_[a-z]+)'/g,(_match,name)=>{assert.ok(Object.hasOwn(variables,name));assert.match(variables[name],/^[a-f0-9-]+$/);return "'"+variables[name]+"'";}).replace("(select system_identifier::text from pg_control_system())","'PURE_NAMESPACE_SEAM'");
    const read=async()=>{const results=await db.exec(sql);return results.find(result=>result.rows.length)?.rows[0];};
    const fresh=(await read()).jsonb_build_object;assert.equal(fresh.provenance.actorsBound,true);assert.equal(fresh.provenance.systemId,"PURE_NAMESPACE_SEAM");assert.deepEqual(fresh.proof,objectProof().proof);
    const retained={id:id(6),bucket_id:"second-brain-staging",name:request.ownerId+"/"+request.uploadId};await db.query("insert into storage.objects(id,bucket_id,name,owner) values($1,$2,$3,$4)",[retained.id,retained.bucket_id,retained.name,request.ownerId]);assert.deepEqual((await read()).jsonb_build_object.proof.objects,[retained]);await db.query("delete from storage.objects where id=$1",[retained.id]);assert.deepEqual((await read()).jsonb_build_object.proof.objects,[]);
    await db.query("delete from auth.sessions where id=$1",[actors.a.sessionId]);assert.equal((await read()).jsonb_build_object.provenance.actorsBound,false);
  }finally{await db.close();}
});


test("original owned transport refuses a divergent response URL before reading or rehydration",async()=>{
  // Extract only this existing arrow's AST initializer, never import/call the
  // runner or its service lifecycle. Explicit fetch/Set/fail bindings are RAM
  // doubles; execution below exercises its real response/body ownership guard.
  const source=await readFile(new URL('../../scripts/verification/capture-image-storage-local-ci.mjs',import.meta.url),'utf8'),ast=ts.createSourceFile('storage-runner.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const runs=ast.statements.filter(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='runCaptureImageStorageLocalCi');assert.equal(runs.length,1);
  const declarations=runs[0].body.statements.filter(ts.isVariableStatement).flatMap(node=>[...node.declarationList.declarations]).filter(node=>ts.isIdentifier(node.name)&&node.name.text==='transport');assert.equal(declarations.length,1);
  const expression=declarations[0].initializer;assert.equal(ts.isArrowFunction(expression),true);assert.deepEqual(expression.parameters.map(node=>node.name.getText(ast)),['url','init']);
  const declared=new Set(['url','init']);const references=new Set();
  const collect=node=>{if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name))declared.add(node.name.text);if(ts.isParameter(node)&&ts.isIdentifier(node.name))declared.add(node.name.text);if(ts.isIdentifier(node)&&!(ts.isPropertyAccessExpression(node.parent)&&node.parent.name===node)&&!(ts.isPropertyAssignment(node.parent)&&node.parent.name===node))references.add(node.text);ts.forEachChild(node,collect);};collect(expression);
  assert.deepEqual([...references].filter(name=>!declared.has(name)).sort(),['Response','Uint8Array','fail','fetch','ownedHttp'].sort());
  const bind=fetch=>{const ownedHttp=new Set(),transport=new Function('fetch','ownedHttp','fail','return ('+expression.getText(ast)+');')(fetch,ownedHttp,code=>{throw new Error(code);});return {transport,ownedHttp};};
  const url='http://127.0.0.1:54321/storage/v1/object/second-brain-staging/synthetic-owned-path';let reads=0;
  const foreign=new Response('synthetic',{status:200});Object.defineProperty(foreign,'url',{value:'http://127.0.0.1:54321/storage/v1/object/foreign'});foreign.body.getReader=()=>{reads++;throw new Error('SYNTHETIC_BODY_MUST_NOT_BE_READ');};
  const denied=bind(async()=>foreign);await assert.rejects(()=>denied.transport(url,{signal:new AbortController().signal}),{message:'CASE_FAILED'});assert.equal(reads,0);assert.equal(denied.ownedHttp.size,0);
  for(const responseUrl of ['',url]){
    let finish;const response=new Response(new ReadableStream({start(controller){finish=()=>{controller.enqueue(new TextEncoder().encode('synthetic-payload'));controller.close();};}}),{status:201,headers:{'content-type':'application/octet-stream','x-synthetic-preserved':'yes'}});if(responseUrl)Object.defineProperty(response,'url',{value:responseUrl});
    const positive=bind(async()=>response),pending=positive.transport(url,{signal:new AbortController().signal});await new Promise(setImmediate);assert.equal(positive.ownedHttp.size,1);finish();const output=await pending;assert.equal(output.status,201);assert.equal(output.headers.get('x-synthetic-preserved'),'yes');assert.equal(await output.text(),'synthetic-payload');assert.equal(positive.ownedHttp.size,0);
  }
});
