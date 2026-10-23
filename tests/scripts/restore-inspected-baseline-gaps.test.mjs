import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { observeInspectedManagedBaseline as observe, inspectedBaselineGapDiagnostic as diagnostic } from "../../scripts/operations/restore-inspected-baseline.mjs";
import { managedRestoreRequirements } from "../../scripts/operations/restore-managed-plan.mjs";
import { customArchiveTocFacts, customTargetInspectionTocFacts } from "../../scripts/operations/restore-custom-toc.mjs";
import { createInspectedBaselineFixture } from "./fixtures/restore-inspected-baseline-fixture.mjs";

// RAM-only public CUSTOM/list/COPY vectors: no files, SDK, process or ports.
const HASH_BYTES=1048576,CANARY="GAP_PRIVATE_CANARY_01",sha=value=>createHash("sha256").update(value).digest("hex");
function withFixture(options,action){const fixture=createInspectedBaselineFixture(options);try{return action(fixture);}finally{fixture.discard();}}
function summary(group,expected){
  const counts=group.dependencyVectorSummary;
  assert.deepEqual(Object.keys(counts),["comparableRows","nonComparableRows","mappedMultisetEqualRows","mappedMultisetDifferentRows"]);
  for(const value of Object.values(counts))assert.equal(Number.isSafeInteger(value)&&value>=0&&value<=group.pairedRecords,true);
  assert.equal(counts.comparableRows+counts.nonComparableRows,group.dependencyMismatchRows);
  assert.equal(counts.mappedMultisetEqualRows+counts.mappedMultisetDifferentRows,counts.comparableRows);
  assert.ok(group.details.filter(row=>row.dependencies?.vectorsComparable===true).length<=counts.comparableRows);
  assert.ok(group.details.filter(row=>row.dependencies?.vectorsComparable===false).length<=counts.nonComparableRows);
  assert.ok(group.details.filter(row=>row.dependencies?.mappedMultisetEqual===true).length<=counts.mappedMultisetEqualRows);
  assert.ok(group.details.filter(row=>row.dependencies?.mappedMultisetEqual===false).length<=counts.mappedMultisetDifferentRows);
  if(expected)assert.deepEqual(counts,expected);
}
function result(fixture){const comparison=observe(...fixture.handles),gap=diagnostic(comparison);for(const group of[gap.managed,gap.added_public])summary(group);return {comparison,gap};}
function hidden(value){const json=JSON.stringify(value);for(const forbidden of[CANARY,"observed_function","PUBLIC_ARTIFICIAL_DEFINITION","supabase_auth_admin","postgres",'"dumpId"','"owner"','"definition"','"namespace"','"ordinal"','"projectRef"','"databaseSha256"'])assert.equal(json.includes(forbidden),false,forbidden);}
function frozen(value){assert.equal(Object.isFrozen(value),true);if(value&&typeof value==="object")for(const child of Object.values(value))if(child&&typeof child==="object")frozen(child);}
function referenceIdentity(kind,namespace,tag,owner){
  const hash=createHash("sha256").update(kind+":");
  for(const part of kind==="DEFAULT ACL"?[namespace,tag,owner]:[namespace,tag]){hash.update(part===null?"N;":"B"+Buffer.byteLength(part)+":");if(part!==null)hash.update(Buffer.from(part));}
  return hash.digest("hex");
}
function assertNoAuthority(comparison,gap){
  assert.equal(comparison.inspectionOnly,true);assert.equal(comparison.baselineQualified,false);assert.equal(comparison.restoreAccepted,false);
  for(const key of["receipt","snapshot","handle","baselineQualified","restoreAccepted","matches","native","authenticatedSource"])assert.equal(Object.hasOwn(gap,key),false);
}

test("no gaps preserves the exact original v1 comparison and disjoint full pair counts",()=>withFixture({},fixture=>{
  const before=managedRestoreRequirements(fixture.source.plan),{comparison,gap}=result(fixture);
  assert.deepEqual(Object.keys(comparison),["version","managed","existingApp","coverage","inspectionOnly","baselineQualified","restoreAccepted"]);
  assert.deepEqual(comparison.managed,{version:1,matches:true,reasons:[]});assert.deepEqual(comparison.existingApp,comparison.managed);
  assert.deepEqual(Object.keys(gap),["version","countsFull","hashBytes","managed","added_public"]);
  assert.equal(gap.version,2);assert.equal(gap.countsFull,true);assert.equal(gap.hashBytes,0);
  assert.equal(gap.managed.pairedRecords,10);assert.equal(gap.added_public.pairedRecords,3);
  for(const group of[gap.managed,gap.added_public]){assert.equal(group.dependencyMismatchRows,0);summary(group,{comparableRows:0,nonComparableRows:0,mappedMultisetEqualRows:0,mappedMultisetDifferentRows:0});assert.equal(group.definitionMismatchRows,0);assert.deepEqual(group.details,[]);assert.equal(group.omittedDetailRows,0);assert.equal(group.byKind.reduce((sum,row)=>sum+row.pairedRecords,0),group.pairedRecords);}
  frozen(gap);hidden(gap);assertNoAuthority(comparison,gap);assert.deepEqual(managedRestoreRequirements(fixture.source.plan),before);
}));
test("renumbering preserves the complete bijection and identity digest is independent of dump IDs",()=>{
  let expected;
  for(const targetIdOffset of[100,777])withFixture({targetIdOffset,target:{overrides:{21:{definition:CANARY}}}},fixture=>{
    const {comparison,gap}=result(fixture);assert.deepEqual(comparison.existingApp.reasons,["definition_mismatch"]);
    const detail=gap.added_public.details[0];assert.equal(detail.identitySha256,referenceIdentity("FUNCTION","public","observed_function(integer, text)"));
    expected??=detail.identitySha256;assert.equal(detail.identitySha256,expected);hidden(gap);
  });
});
test("managed mismatch is not counted again in the added_public group",()=>withFixture({target:{overrides:{7:{definition:CANARY}}}},fixture=>{
  const {comparison,gap}=result(fixture);assert.deepEqual(comparison.managed.reasons,["definition_mismatch"]);assert.deepEqual(comparison.existingApp.reasons,["definition_mismatch"]);
  assert.equal(gap.managed.definitionMismatchRows,1);assert.equal(gap.added_public.definitionMismatchRows,0);assert.equal(gap.managed.details[0].scope,"auth");hidden(gap);
}));
test("dependency permutation keeps ordered refusal while explicitly reporting equal mapped multiset",()=>withFixture({source:{overrides:{21:{dependencies:[20,4]}}},target:{overrides:{21:{dependencies:[4,20]}}}},fixture=>{
  const {comparison,gap}=result(fixture);assert.deepEqual(comparison.existingApp.reasons,["dependency_vector_mismatch"]);
  const deps=gap.added_public.details[0].dependencies;assert.deepEqual({...deps,sourceAtFirst:null,targetAtFirst:null},{sourceCount:2,targetCount:2,sourceUnique:2,targetUnique:2,firstDifferentIndex:0,vectorsComparable:true,mappedMultisetEqual:true,sourceAtFirst:null,targetAtFirst:null});
  assert.equal(deps.sourceAtFirst.identitySha256,referenceIdentity("SCHEMA",null,"public"));assert.equal(deps.targetAtFirst.identitySha256,referenceIdentity("SCHEMA",null,"auth"));
  summary(gap.added_public,{comparableRows:1,nonComparableRows:0,mappedMultisetEqualRows:1,mappedMultisetDifferentRows:0});
  assert.equal(deps.sourceAtFirst.state,"identity");hidden(gap);
}));
test("same vector multiplicities at different positions remain an ordered mismatch",()=>withFixture({source:{overrides:{21:{dependencies:[20,4,4]}}},target:{overrides:{21:{dependencies:[4,20,4]}}}},fixture=>{
  const {comparison,gap}=result(fixture);assert.deepEqual(comparison.existingApp.reasons,["dependency_vector_mismatch"]);
  const deps=gap.added_public.details[0].dependencies;assert.equal(deps.sourceUnique,2);assert.equal(deps.targetUnique,2);assert.equal(deps.sourceCount,3);assert.equal(deps.mappedMultisetEqual,true);
}));
test("length and multiplicity changes do not become multiset equality or an invented raw ID",()=>withFixture({source:{overrides:{21:{dependencies:[20,4]}}},target:{overrides:{21:{dependencies:[20,4,4]}}}},fixture=>{
  const {comparison,gap}=result(fixture);assert.deepEqual(comparison.existingApp.reasons,["dependency_vector_mismatch"]);
  const deps=gap.added_public.details[0].dependencies;assert.equal(deps.firstDifferentIndex,2);assert.equal(deps.mappedMultisetEqual,false);assert.deepEqual(deps.sourceAtFirst,{state:"end",identitySha256:null});assert.equal(deps.targetAtFirst.state,"identity");assert.equal(deps.targetUnique,2);
  summary(gap.added_public,{comparableRows:1,nonComparableRows:0,mappedMultisetEqualRows:0,mappedMultisetDifferentRows:1});
}));
test("equal-length different references remain a mapped-identity mismatch",()=>withFixture({source:{overrides:{21:{dependencies:[20]}}},target:{overrides:{21:{dependencies:[4]}}}},fixture=>{
  const {comparison,gap}=result(fixture);assert.deepEqual(comparison.existingApp.reasons,["dependency_vector_mismatch"]);
  assert.equal(gap.added_public.details[0].dependencies.mappedMultisetEqual,false);assert.equal(gap.added_public.details[0].dependencies.firstDifferentIndex,0);
}));
test("unresolved scope is preserved separately; it is not normalized into a vector match",()=>withFixture({source:{overrides:{21:{dependencies:[12]}}},target:{overrides:{21:{dependencies:[12,20]}}}},fixture=>{
  const {comparison,gap}=result(fixture);assert.deepEqual(comparison.existingApp.reasons,["dependency_scope_unsupported","dependency_vector_mismatch"]);
  const deps=gap.added_public.details[0].dependencies;assert.equal(deps.vectorsComparable,false);assert.equal(deps.mappedMultisetEqual,null);assert.deepEqual(deps.sourceAtFirst,{state:"end",identitySha256:null});assert.equal(deps.targetAtFirst.state,"identity");hidden(gap);
  summary(gap.added_public,{comparableRows:0,nonComparableRows:1,mappedMultisetEqualRows:0,mappedMultisetDifferentRows:0});
}));
test("unresolved equal-length edges alone do not invent a dependency vector reason/detail",()=>withFixture({source:{overrides:{21:{dependencies:[12]}}},target:{overrides:{21:{dependencies:[12]}}}},fixture=>{
  const {comparison,gap}=result(fixture);assert.deepEqual(comparison.existingApp.reasons,["dependency_scope_unsupported"]);assert.equal(gap.added_public.dependencyMismatchRows,0);assert.deepEqual(gap.added_public.details,[]);
}));
test("NULL and empty definition have distinct closed states and the real empty SHA256",()=>withFixture({source:{overrides:{21:{definition:null}}},target:{overrides:{21:{definition:""}}}},fixture=>{
  const {comparison,gap}=result(fixture);assert.deepEqual(comparison.existingApp.reasons,["definition_mismatch"]);
  assert.deepEqual(gap.added_public.details[0].definitionGap,{source:{state:"null",bytes:null,sha256:null,hashStatus:"null"},target:{state:"bytes",bytes:0,sha256:sha(Buffer.alloc(0)),hashStatus:"complete"}});hidden(gap);
}));
for(const [name,source,target]of[["CRLF","value\n","value\r\n"],["whitespace","value","value "],["Unicode","é","e\u0301"]])test("definition "+name+" remains full-byte distinct",()=>withFixture({source:{overrides:{21:{definition:source}}},target:{overrides:{21:{definition:target}}}},fixture=>{
  const {comparison,gap}=result(fixture);assert.deepEqual(comparison.existingApp.reasons,["definition_mismatch"]);const bytes=gap.added_public.details[0].definitionGap;
  assert.equal(bytes.source.bytes,Buffer.byteLength(source));assert.equal(bytes.target.bytes,Buffer.byteLength(target));assert.equal(bytes.source.sha256,sha(source));assert.equal(bytes.target.sha256,sha(target));assert.notEqual(bytes.source.sha256,bytes.target.sha256);
}));
test("DEFAULT ACL owner affects only hashed identity; owner change remains original identity mismatch",()=>{
  withFixture({target:{overrides:{23:{definition:CANARY}}}},fixture=>{
    const {gap}=result(fixture);assert.equal(gap.added_public.details[0].identitySha256,referenceIdentity("DEFAULT ACL","public","DEFAULT PRIVILEGES FOR FUNCTIONS","postgres"));hidden(gap);
  });
  withFixture({target:{overrides:{23:{owner:"other_grantor"}}}},fixture=>{const {comparison,gap}=result(fixture);assert.deepEqual(comparison.existingApp.reasons,["identity_set_mismatch"]);assert.equal(gap.added_public.pairedRecords,2);assert.equal(gap.added_public.details.length,0);});
});
test("other original mismatch reasons are neither suppressed nor falsely explained",()=>withFixture({target:{overrides:{21:{owner:"changed_owner",dropStatement:CANARY}}}},fixture=>{
  const {comparison,gap}=result(fixture);assert.deepEqual(comparison.existingApp.reasons,["drop_statement_mismatch","owner_mismatch"]);assert.equal(gap.added_public.definitionMismatchRows,0);assert.deepEqual(gap.added_public.details,[]);hidden(gap);
}));
test("eight details per disjoint group retain full counts and explicit omissions",()=>{
  const managed=Array.from({length:10},(_,index)=>({id:50+index,kind:"FUNCTION",schema:"auth",tag:"managed_synthetic_"+index+"()",dependencies:[4]}));
  const app=Array.from({length:10},(_,index)=>({id:70+index,kind:"FUNCTION",schema:"public",tag:"app_synthetic_"+index+"()",dependencies:[20]}));
  const rows=[...managed,...app];
  withFixture({source:{extraRows:rows},target:{extraRows:rows.map(row=>({...row,definition:CANARY+row.id}))}},fixture=>{
    const {comparison,gap}=result(fixture);assert.deepEqual(comparison.managed.reasons,["definition_mismatch"]);assert.deepEqual(comparison.existingApp.reasons,["definition_mismatch"]);
    assert.equal(gap.managed.pairedRecords,20);assert.equal(gap.added_public.pairedRecords,13);
    for(const group of[gap.managed,gap.added_public]){assert.equal(group.definitionMismatchRows,10);assert.equal(group.details.length,8);assert.equal(group.omittedDetailRows,2);assert.equal(group.omissions.detailLimitRows,2);assert.equal(group.omissions.hashBudgetRows,0);}
    assert.equal(gap.managed.details[0].identitySha256,referenceIdentity("FUNCTION","auth","managed_synthetic_0()"));assert.equal(gap.added_public.details[0].identitySha256,referenceIdentity("FUNCTION","public","app_synthetic_0()"));hidden(gap);frozen(gap);
  });
});
test("one shared hash budget includes identities and omits full definitions without truncation",()=>withFixture({source:{overrides:{21:{definition:"a".repeat(700000)},22:{definition:"b".repeat(700000)}}},target:{overrides:{21:{definition:"c".repeat(700000)},22:{definition:"d".repeat(700000)}}}},fixture=>{
  const {comparison,gap}=result(fixture);assert.deepEqual(comparison.existingApp.reasons,["definition_mismatch"]);assert.equal(gap.added_public.definitionMismatchRows,2);assert.ok(gap.hashBytes>700000&&gap.hashBytes<=HASH_BYTES);
  const first=gap.added_public.details[0].definitionGap;assert.equal(first.source.hashStatus,"complete");assert.equal(first.source.sha256,sha("a".repeat(700000)));assert.equal(first.target.hashStatus,"omitted_limit");assert.equal(first.target.bytes,700000);assert.equal(first.target.sha256,null);assert.equal(gap.added_public.omissions.definitionHashes,3);hidden(gap);
}));
test("an exhausted shared hash budget omits later rows but preserves all comparison counts",()=>withFixture({source:{overrides:{4:{definition:"x".repeat(HASH_BYTES-16)}}},target:{overrides:{21:{definition:CANARY}}}},fixture=>{
  const {comparison,gap}=result(fixture);assert.deepEqual(comparison.managed.reasons,["definition_mismatch"]);assert.deepEqual(comparison.existingApp.reasons,["definition_mismatch"]);
  assert.equal(gap.hashBytes,HASH_BYTES);assert.equal(gap.managed.details.length,1);assert.equal(gap.managed.omissions.definitionHashes,1);
  assert.equal(gap.added_public.definitionMismatchRows,1);assert.equal(gap.added_public.details.length,0);assert.equal(gap.added_public.omittedDetailRows,1);assert.equal(gap.added_public.omissions.hashBudgetRows,1);hidden(gap);
}));
test("all 36 managed mismatches are classified before the eight-detail cap, separately from public pairs",()=>{
  const managed=Array.from({length:36},(_,index)=>({id:50+index,kind:"FUNCTION",schema:"auth",tag:"managed_full_count_"+index+"()",dependencies:index<8?[4,5]:index<20?[4]:[12]}));
  const app=Array.from({length:9},(_,index)=>({id:100+index,kind:"FUNCTION",schema:"public",tag:"public_full_count_"+index+"()",dependencies:index<3?[20,4]:index<6?[20]:[12]}));
  const targetManaged=managed.map((row,index)=>({...row,dependencies:index<8?[5,4]:index<20?[5]:[12,4]}));
  const targetApp=app.map((row,index)=>({...row,dependencies:index<3?[4,20]:index<6?[4]:[12,20]}));
  withFixture({source:{extraRows:[...managed,...app]},target:{extraRows:[...targetManaged,...targetApp]}},fixture=>{
    const {comparison,gap}=result(fixture);
    assert.deepEqual(comparison.managed.reasons,["dependency_scope_unsupported","dependency_vector_mismatch"]);
    assert.deepEqual(comparison.existingApp.reasons,comparison.managed.reasons);
    assert.equal(gap.managed.dependencyMismatchRows,36);assert.equal(gap.managed.details.length,8);assert.equal(gap.managed.omittedDetailRows,28);assert.equal(gap.managed.omissions.detailLimitRows,28);
    assert.equal(gap.managed.details.every(row=>row.dependencies.vectorsComparable&&row.dependencies.mappedMultisetEqual),true);
    summary(gap.managed,{comparableRows:20,nonComparableRows:16,mappedMultisetEqualRows:8,mappedMultisetDifferentRows:12});
    assert.equal(gap.added_public.dependencyMismatchRows,9);assert.equal(gap.added_public.details.length,8);assert.equal(gap.added_public.omittedDetailRows,1);
    summary(gap.added_public,{comparableRows:6,nonComparableRows:3,mappedMultisetEqualRows:3,mappedMultisetDifferentRows:3});
    assert.equal(gap.managed.definitionMismatchRows,0);assert.equal(gap.added_public.definitionMismatchRows,0);assert.equal(gap.countsFull,true);assert.ok(Buffer.byteLength(JSON.stringify(gap))<65536);frozen(gap);hidden(gap);assertNoAuthority(comparison,gap);
  });
});
test("exhausting the hash budget does not omit an equal-multiset aggregate classification",()=>withFixture({source:{overrides:{4:{definition:"x".repeat(HASH_BYTES-16)},21:{dependencies:[20,4]}}},target:{overrides:{21:{dependencies:[4,20]}}}},fixture=>{
  const {comparison,gap}=result(fixture);assert.deepEqual(comparison.existingApp.reasons,["dependency_vector_mismatch","definition_mismatch"]);
  assert.equal(gap.hashBytes,HASH_BYTES);assert.equal(gap.added_public.details.length,0);assert.equal(gap.added_public.omissions.hashBudgetRows,1);
  summary(gap.added_public,{comparableRows:1,nonComparableRows:0,mappedMultisetEqualRows:1,mappedMultisetDifferentRows:0});hidden(gap);assertNoAuthority(comparison,gap);
}));
test("managed and union contexts are not correlated by aggregate counts",()=>withFixture({source:{overrides:{7:{dependencies:[4,20,21]}}},target:{overrides:{7:{dependencies:[4,21,20]}}}},fixture=>{
  const {comparison,gap}=result(fixture);assert.deepEqual(comparison.managed.reasons,["dependency_scope_unsupported"]);assert.deepEqual(comparison.existingApp.reasons,["dependency_vector_mismatch"]);
  for(const group of[gap.managed,gap.added_public]){assert.equal(group.dependencyMismatchRows,0);summary(group,{comparableRows:0,nonComparableRows:0,mappedMultisetEqualRows:0,mappedMultisetDifferentRows:0});}
  hidden(gap);assertNoAuthority(comparison,gap);
}));
test("nominal getter refuses clones, proxies, descriptors and extra args without invoking hooks",()=>withFixture({},fixture=>{
  const {comparison,gap}=result(fixture);let calls=0;
  const hostile=new Proxy(comparison,{get(){calls++;throw Error(CANARY);},getOwnPropertyDescriptor(){calls++;throw Error(CANARY);},ownKeys(){calls++;throw Error(CANARY);}});
  const getter={get comparisonGapDiagnostic(){calls++;throw Error(CANARY);}};
  for(const value of[undefined,null,0,"text",{},JSON.parse(JSON.stringify(comparison)),hostile,getter])assert.throws(()=>diagnostic(value),{code:"RESTORE_INSPECTED_BASELINE_REQUIRED"});
  assert.throws(()=>diagnostic(comparison,{}),{code:"RESTORE_INSPECTED_BASELINE_REQUIRED"});assert.equal(calls,0);assert.equal(diagnostic(comparison),gap);
}));
test("byte-view getters/iterators/toJSON never execute and raw canaries never escape",()=>withFixture({target:{overrides:{21:{definition:CANARY}}}},fixture=>{
  let calls=0;
  for(const handle of[fixture.source.tocHandle,fixture.target.tocHandle]){
    const facts=handle===fixture.source.tocHandle?customArchiveTocFacts(handle):customTargetInspectionTocFacts(handle);
    for(const row of facts.records)for(const field of["tag","namespace","owner","definition"])if(row[field]!==null)for(const key of["buffer","byteLength","toJSON",Symbol.iterator])Object.defineProperty(row[field],key,{configurable:true,get(){calls++;throw Error(CANARY);}});
  }
  const {comparison,gap}=result(fixture);assert.equal(calls,0);hidden(gap);hidden(comparison);assertNoAuthority(comparison,gap);frozen(gap);
}));
test("diagnostic remains an immutable observation after source disposal, never a reusable handle",()=>{
  const fixture=createInspectedBaselineFixture({target:{overrides:{21:{definition:CANARY}}}}),{comparison,gap}=result(fixture);fixture.discard();
  assert.equal(diagnostic(comparison),gap);assert.equal(gap.added_public.definitionMismatchRows,1);assertNoAuthority(comparison,gap);hidden(gap);
  assert.throws(()=>observe(gap,...fixture.handles.slice(1)),{code:"RESTORE_INSPECTED_BASELINE_REQUIRED"});
});
