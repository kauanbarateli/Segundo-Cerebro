/** Public infrastructure-shaped fixtures. No SQL is parsed/applied, grants
 * interpreted, target prepared or authority manufactured from an observation. */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { planManagedTargetBaseline, managedTargetBaselineRequirements } from "../../scripts/operations/restore-managed-plan.mjs";
import { observeInspectedManagedBaseline } from "../../scripts/operations/restore-inspected-baseline.mjs";
import { createInspectedBaselineFixture } from "./fixtures/restore-inspected-baseline-fixture.mjs";

const withFixture=(options,work)=>{const fixture=createInspectedBaselineFixture(options);try{return work(fixture);}finally{fixture.discard();}};
const compare=fixture=>observeInspectedManagedBaseline(...fixture.handles);
const noAuthority=result=>{assert.equal(result.inspectionOnly,true);assert.equal(result.baselineQualified,false);assert.equal(result.restoreAccepted,false);};

test("equal public helper/ACL/default-ACL bytes still do not qualify the operational empty-target baseline",()=>{
  withFixture({},fixture=>{
    const result=compare(fixture);assert.equal(result.existingApp.matches,true);noAuthority(result);
    const database=fixture.target.database;
    assert.throws(()=>planManagedTargetBaseline(fixture.target.toc,{projectRef:"t".repeat(20),databaseName:"postgres",nativeDumpSha256:createHash("sha256").update(database).digest("hex"),nativeDumpBytes:database.length}),{code:"RESTORE_MANAGED_TARGET_SCOPE_UNSUPPORTED"});
    for(const value of [result,structuredClone(result),{...result,baselineQualified:true}])assert.throws(()=>managedTargetBaselineRequirements(value),{code:"RESTORE_MANAGED_TARGET_BASELINE_REQUIRED"});
  });
});

test("helper, its ACL and default-ACL definition differences survive exact dependency agreement",()=>{
  // Text is explicitly artificial fixture data, not a proposed ACL policy or
  // a reconstruction of any real definition from a hash or its length.
  for(const [id,source,target]of[
    [21,"-- PUBLIC_HELPER_BODY_A\n","-- PUBLIC_HELPER_BODY_B\n"],
    [22,"-- PUBLIC_ACL_SCHEMA_RESTRICTED\n","-- PUBLIC_ACL_SCHEMA_OTHER\n"],
    [23,"-- PUBLIC_DEFAULT_GLOBAL_SCOPE\n","-- PUBLIC_DEFAULT_SCHEMA_SCOPE\n"],
  ])withFixture({source:{overrides:{[id]:{definition:source}}},target:{overrides:{[id]:{definition:target}}}},fixture=>{
    const result=compare(fixture);assert.deepEqual(result.managed.reasons,[]);assert.deepEqual(result.existingApp.reasons,["definition_mismatch"]);noAuthority(result);
    const publicResult=JSON.stringify(result);assert.ok(!publicResult.includes("PUBLIC_HELPER")&&!publicResult.includes("PUBLIC_ACL")&&!publicResult.includes("PUBLIC_DEFAULT"));
  });
});

test("formatting and changes inside a public literal are not normalized to equal helper definitions",()=>{
  const original="-- PUBLIC_HELPER\nSELECT 'a b';\n";
  for(const changed of[original.replaceAll("\n","\r\n"),"-- PUBLIC_HELPER\nSELECT 'ab';\n",original+" ",null,""]){
    withFixture({source:{overrides:{21:{definition:original}}},target:{overrides:{21:{definition:changed}}}},fixture=>{
      const result=compare(fixture);assert.deepEqual(result.existingApp.reasons,["definition_mismatch"]);noAuthority(result);
    });
  }
});

test("DEFAULT ACL owner remains its issuer identity while ordinary helper owner remains a semantic field",()=>{
  withFixture({target:{overrides:{23:{owner:"supabase_admin"}}}},fixture=>{
    const result=compare(fixture);assert.ok(result.existingApp.reasons.includes("identity_set_mismatch"));assert.equal(result.existingApp.matches,false);noAuthority(result);
  });
  withFixture({target:{overrides:{21:{owner:"supabase_admin"}}}},fixture=>{
    const result=compare(fixture);assert.deepEqual(result.existingApp.reasons,["owner_mismatch"]);noAuthority(result);
  });
});

test("matching edge occurrences cannot hide a public definition gap or either history mismatch",()=>{
  withFixture({source:{overrides:{21:{dependencies:[20,4,20]}}},target:{overrides:{21:{dependencies:[4,20,20],definition:"-- PUBLIC_DIFFERENT_BODY\n"}}},targetHistories:{auth:[{version:"20240102"}],storage:[{id:0,name:"initial",hash:"b".repeat(40),executed_at:null}]}},fixture=>{
    const result=compare(fixture);assert.deepEqual(result.managed.reasons,["auth_history_mismatch","storage_history_mismatch"]);
    assert.deepEqual(result.existingApp.reasons,["dependency_vector_mismatch","definition_mismatch","auth_history_mismatch","storage_history_mismatch"]);noAuthority(result);
  });
});
