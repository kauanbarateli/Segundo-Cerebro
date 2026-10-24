/** Public artificial wire vectors only. No archive, PG executable, DB or IO. */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { planManagedTargetInspection } from "../../scripts/operations/restore-managed-plan.mjs";
import { customArchiveTocFacts, customTargetInspectionTocFacts, extractCustomTargetInspectionToc, discardCustomTargetInspectionToc } from "../../scripts/operations/restore-custom-toc.mjs";
import { observeInspectedManagedBaseline } from "../../scripts/operations/restore-inspected-baseline.mjs";
import { createInspectedBaselineFixture } from "./fixtures/restore-inspected-baseline-fixture.mjs";

const withFixture = (options, work) => { const fixture=createInspectedBaselineFixture(options);try{return work(fixture);}finally{fixture.discard();} };
const compare = fixture => observeInspectedManagedBaseline(...fixture.handles);
function row(fixture, side, id) {
  const facts=side==="source"?customArchiveTocFacts(fixture.source.tocHandle):customTargetInspectionTocFacts(fixture.target.tocHandle);
  const value=facts.records.find(value=>value.dumpId===id);assert.ok(value,"Expected artificial fixture row");return value;
}
const dependencies = (fixture,side,id) => [...row(fixture,side,id).dependencies];
const noAuthority = result => {assert.equal(result.inspectionOnly,true);assert.equal(result.baselineQualified,false);assert.equal(result.restoreAccepted,false);};
const sourceOptions={overrides:{21:{dependencies:[20,4,20]}}};
const targetOptions={overrides:{21:{dependencies:[4,20,20]}}};

test("original binary/list order survives extraction and a mapped permutation stays an A2 refusal", t=>{
  t.diagnostic(`Node ${process.versions.node}; artificial fixtures only; nativeExecuted=false`);
  withFixture({source:sourceOptions,target:targetOptions},fixture=>{
    const beforeSource=dependencies(fixture,"source",21),beforeTarget=dependencies(fixture,"target",121);
    assert.deepEqual(beforeSource,[20,4,20]);assert.deepEqual(beforeTarget,[104,120,120]);
    assert.match(fixture.source.toc,/;\tdepends on: 20 4 20\n/);assert.match(fixture.target.toc,/;\tdepends on: 104 120 120\n/);
    const result=compare(fixture);assert.deepEqual(result.managed.reasons,[]);assert.deepEqual(result.existingApp.reasons,["dependency_vector_mismatch"]);noAuthority(result);
    assert.deepEqual(dependencies(fixture,"source",21),beforeSource);assert.deepEqual(dependencies(fixture,"target",121),beforeTarget);
  });
});

test("matching original sequence permits only an inspection comparison, with duplicate occurrences retained",()=>{
  withFixture({source:sourceOptions,target:sourceOptions},fixture=>{
    const result=compare(fixture);assert.equal(result.managed.matches,true);assert.equal(result.existingApp.matches,true);noAuthority(result);
    assert.deepEqual(dependencies(fixture,"source",21),[20,4,20]);assert.deepEqual(dependencies(fixture,"target",121),[120,104,120]);
  });
});

test("a missing or extra duplicate never becomes the same vector",()=>{
  for(const vector of [[4,20],[4,20,20,20]])withFixture({source:sourceOptions,target:{overrides:{21:{dependencies:vector}}}},fixture=>{
    const result=compare(fixture);assert.deepEqual(result.existingApp.reasons,["dependency_vector_mismatch"]);noAuthority(result);
    assert.equal(dependencies(fixture,"target",121).length,vector.length);
  });
});

test("binary and native-list permutations must agree before A2, even with independently correct bindings",()=>{
  const original=createInspectedBaselineFixture({source:sourceOptions,target:sourceOptions}),permuted=createInspectedBaselineFixture({source:sourceOptions,target:targetOptions});
  try{
    // Each plan binds the actual artificial bytes supplied. Only the binary/list
    // relation is inconsistent; checksum/binding failure is not the oracle.
    for(const [list,bytes] of [[original.target.toc,permuted.target.database],[permuted.target.toc,original.target.database]]){
      const plan=planManagedTargetInspection(list,{projectRef:"t".repeat(20),databaseName:"postgres",nativeDumpSha256:createHash("sha256").update(bytes).digest("hex"),nativeDumpBytes:bytes.length});
      let handle;try{assert.throws(()=>{handle=extractCustomTargetInspectionToc(plan,bytes);},{code:"RESTORE_CUSTOM_TOC_PLAN_MISMATCH"});}finally{if(handle)discardCustomTargetInspectionToc(handle);}
    }
  }finally{original.discard();permuted.discard();}
});

test("managed and union contexts remain distinct rather than sharing an order verdict",()=>{
  withFixture({source:{overrides:{7:{dependencies:[4,20,21]}}},target:{overrides:{7:{dependencies:[4,21,20]}}}},fixture=>{
    const result=compare(fixture);assert.deepEqual(result.managed.reasons,["dependency_scope_unsupported"]);assert.deepEqual(result.existingApp.reasons,["dependency_vector_mismatch"]);noAuthority(result);
    assert.deepEqual(dependencies(fixture,"source",7),[4,20,21]);assert.deepEqual(dependencies(fixture,"target",107),[104,121,120]);
  });
});
