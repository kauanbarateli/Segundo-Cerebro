import test from "node:test";
import assert from "node:assert/strict";
import { inspect } from "node:util";
import { observeInspectedManagedBaseline as observe, INSPECTED_BASELINE_ERROR_CODES, INSPECTED_BASELINE_LIMITS } from "../../scripts/operations/restore-inspected-baseline.mjs";
import { managedRestoreRequirements } from "../../scripts/operations/restore-managed-plan.mjs";
import { customArchiveTocFacts, customTargetInspectionTocFacts, discardCustomArchiveToc, discardCustomTargetInspectionToc } from "../../scripts/operations/restore-custom-toc.mjs";
import { migrationHistoryFacts, inspectionMigrationHistoryFacts, discardMigrationHistory, discardInspectionMigrationHistory } from "../../scripts/operations/restore-migration-history.mjs";
import { createInspectedBaselineFixture } from "./fixtures/restore-inspected-baseline-fixture.mjs";

// Genuine nominal modules over public artificial CUSTOM/list/COPY fixtures.
// No process, filesystem, original archive/profile, network or native receipt.
const CANARY="PRIVATE_INSPECTED_BASELINE_CANARY",code=suffix=>"RESTORE_INSPECTED_BASELINE_"+suffix;
const run=fixture=>observe(...fixture.handles);
function hidden(result){const value=JSON.stringify(result);for(const privateText of[CANARY,"observed_function","DEFAULT PRIVILEGES","supabase_auth_admin","PUBLIC_ARTIFICIAL_DEFINITION",'"dumpId"','"owner"','"projectRef"','"databaseSha256"'])assert.equal(value.includes(privateText),false);}
function refuse(fn,suffix){assert.throws(fn,error=>{assert.equal(error.code,code(suffix));assert.equal(error.message,code(suffix));assert.equal(INSPECTED_BASELINE_ERROR_CODES.includes(error.code),true);assert.equal(Object.hasOwn(error,"cause"),false);for(const value of[JSON.stringify(error),inspect(error),error.stack])assert.equal(value.includes(CANARY),false);return true;});}
function withFixture(options,action){const fixture=createInspectedBaselineFixture(options);try{return action(fixture);}finally{fixture.discard();}}

test("pure observation fully covers target metadata, keeps both A2 results and never changes Source selection",()=>withFixture({},fixture=>{
  const before=managedRestoreRequirements(fixture.source.plan),binding=customTargetInspectionTocFacts(fixture.target.tocHandle).binding,result=run(fixture);
  assert.deepEqual(result.managed,{version:1,matches:true,reasons:[]});assert.deepEqual(result.existingApp,{version:1,matches:true,reasons:[]});assert.deepEqual(result.coverage,{sourceEntries:24,sourcePreservedEntries:10,targetEntries:17,targetBaselineEntries:10,targetStateEntries:4,targetAppEntries:3,sourceAppCounterparts:3,coverageComplete:true});assert.equal(result.inspectionOnly,true);assert.equal(result.baselineQualified,false);assert.equal(result.restoreAccepted,false);assert.equal(result instanceof Promise,false);for(const part of[result,result.coverage,result.managed,result.existingApp,result.managed.reasons,result.existingApp.reasons])assert.equal(Object.isFrozen(part),true);assert.deepEqual(managedRestoreRequirements(fixture.source.plan),before);assert.equal(customTargetInspectionTocFacts(fixture.target.tocHandle).binding,binding);assert.equal(binding.side,"target-inspection");hidden(result);
}));
test("Source product extras stay selected and do not enter the target-observed union",()=>withFixture({source:{extraRows:[{id:50,kind:"FUNCTION",schema:"public",tag:"product_only_function()",dependencies:[20],definition:"-- "+CANARY}]}},fixture=>{
  const before=managedRestoreRequirements(fixture.source.plan),result=run(fixture);assert.equal(result.managed.matches,true);assert.equal(result.existingApp.matches,true);assert.equal(result.coverage.sourceEntries,25);assert.equal(result.coverage.sourceAppCounterparts,3);assert.equal(before.selected.some(row=>row.id===50),true);assert.deepEqual(managedRestoreRequirements(fixture.source.plan),before);hidden(result);
}));
test("renumbered target IDs and complete identity match independently of numeric IDs or OIDs",()=>withFixture({targetIdOffset:777},fixture=>{
  const result=run(fixture);assert.equal(result.managed.matches,true);assert.equal(result.existingApp.matches,true);assert.equal(result.coverage.targetEntries,17);
}));
test("every extra public candidate remains in the target DTO instead of filtering by expected names",()=>{
  for(const kind of["FUNCTION","ACL","DEFAULT ACL"]){withFixture({target:{extraRows:[{id:50,kind,schema:"public",tag:kind==="DEFAULT ACL"?"DEFAULT PRIVILEGES FOR TABLES":"extra_unmatched_"+kind,dependencies:[20]}]}},fixture=>{
    const result=run(fixture);assert.equal(result.managed.matches,true);assert.equal(result.existingApp.matches,false);assert.equal(result.existingApp.reasons.includes("identity_set_mismatch"),true);assert.equal(result.coverage.targetAppEntries,4);assert.equal(result.coverage.sourceAppCounterparts,3);assert.equal(result.coverage.targetBaselineEntries+result.coverage.targetStateEntries+result.coverage.targetAppEntries,result.coverage.targetEntries);hidden(result);
  });}
});
test("a missing target app object is not reconstructed from Source or added to a replay selection",()=>withFixture({target:{omit:[22]}},fixture=>{
  const result=run(fixture);assert.equal(result.managed.matches,true);assert.equal(result.existingApp.matches,true);assert.equal(result.coverage.targetAppEntries,2);assert.equal(result.coverage.sourceAppCounterparts,2);assert.equal(managedRestoreRequirements(fixture.source.plan).selected.some(row=>row.id===22),true);
}));
for(const [id,field,value,reason]of[[21,"definition","-- "+CANARY,"definition_mismatch"],[22,"definition","REVOKE EXECUTE FROM PUBLIC;\n","definition_mismatch"],[21,"owner","other_owner","owner_mismatch"],[23,"owner","other_grantor","identity_set_mismatch"]])test("public candidate original bytes remain authoritative: "+id+"/"+field,()=>withFixture({target:{overrides:{[id]:{[field]:value}}}},fixture=>{
  const result=run(fixture);assert.equal(result.managed.matches,true);assert.equal(result.existingApp.matches,false);assert.equal(result.existingApp.reasons.includes(reason),true);hidden(result);
}));
test("NULL and empty function definition remain distinct and never normalize SQL",()=>withFixture({source:{overrides:{21:{definition:null}}},target:{overrides:{21:{definition:""}}}},fixture=>{
  assert.deepEqual(run(fixture).existingApp.reasons,["definition_mismatch"]);
}));
test("ACL whitespace and CRLF differences remain A2 mismatches",()=>{
  for(const definition of["-- PUBLIC_ARTIFICIAL_DEFINITION\n ","-- PUBLIC_ARTIFICIAL_DEFINITION\r\n"]){withFixture({target:{overrides:{22:{definition}}}},fixture=>{assert.deepEqual(run(fixture).existingApp.reasons,["definition_mismatch"]);});}
});
test("dependency order and multiplicity are compared through the full bijection",()=>{
  for(const dependencies of[[4,20],[20,4,4]]){withFixture({source:{overrides:{21:{dependencies:[20,4]}}},target:{overrides:{21:{dependencies}}}},fixture=>{
    const result=run(fixture);assert.equal(result.managed.matches,true);assert.deepEqual(result.existingApp.reasons,["dependency_vector_mismatch"]);
  });}
});
test("an edge to nonhistorical DATA remains unsupported without inventing closure or cutting the vector",()=>withFixture({source:{overrides:{21:{dependencies:[12]}}},target:{overrides:{21:{dependencies:[12]}}}},fixture=>{
  const result=run(fixture);assert.equal(result.managed.matches,true);assert.deepEqual(result.existingApp.reasons,["dependency_scope_unsupported"]);assert.deepEqual(managedRestoreRequirements(fixture.source.plan).selected.find(row=>row.id===21).dependencies,[12]);
}));
test("ambiguous complete identities anywhere in SourceALL or target refuse",()=>{
  for(const side of["source","target"]){withFixture({[side]:{extraRows:[{id:50,kind:"FUNCTION",schema:"public",tag:"observed_function(integer, text)",dependencies:[20]}]}},fixture=>{refuse(()=>run(fixture),"AMBIGUOUS");});}
  withFixture({source:{extraRows:[{id:50,kind:"FUNCTION",schema:"public",tag:"product_only_duplicate()",dependencies:[20]},{id:51,kind:"FUNCTION",schema:"public",tag:"product_only_duplicate()",dependencies:[20]}]}},fixture=>{refuse(()=>run(fixture),"AMBIGUOUS");});
});
test("DEFAULT ACL full owner participates in identity and distinct grantors remain separate candidates",()=>withFixture({source:{extraRows:[{id:50,kind:"DEFAULT ACL",schema:"public",tag:"DEFAULT PRIVILEGES FOR FUNCTIONS",owner:"other_grantor",dependencies:[20]}]},target:{extraRows:[{id:50,kind:"DEFAULT ACL",schema:"public",tag:"DEFAULT PRIVILEGES FOR FUNCTIONS",owner:"other_grantor",dependencies:[20]}]}},fixture=>{
  const result=run(fixture);assert.equal(result.existingApp.matches,true);assert.equal(result.coverage.targetAppEntries,4);assert.equal(result.coverage.sourceAppCounterparts,4);
}));
test("unclassified target scope refuses rather than disappearing from counts",()=>{
  for(const row of[{id:50,kind:"TABLE",schema:"public",tag:"unexpected_table",dependencies:[20]},{id:50,kind:"FUNCTION",schema:"app_private",tag:"unexpected_function()",dependencies:[]},{id:50,kind:"FUNCTION",schema:"extensions",tag:"unexpected_function()",dependencies:[]},{id:50,kind:"COMMENT",schema:"-",tag:"unrecognized_global",dependencies:[]},{id:50,kind:"DEFAULT ACL",schema:"-",tag:"DEFAULT PRIVILEGES FOR FUNCTIONS",dependencies:[]}]){withFixture({target:{extraRows:[row]}},fixture=>{refuse(()=>run(fixture),"SCOPE_UNSUPPORTED");});}
});
test("the four Source customizations remain forbidden on the target even if their class is managed",()=>{
  for(const row of[{id:50,kind:"TRIGGER",schema:"auth",tag:"users second_brain_identity_created",dependencies:[7]},{id:50,kind:"TRIGGER",schema:"auth",tag:"users second_brain_admin_creation_final",dependencies:[7]},{id:50,kind:"POLICY",schema:"storage",tag:"objects second_brain_private_objects",owner:"supabase_storage_admin",dependencies:[8]},{id:50,kind:"POLICY",schema:"storage",tag:"buckets second_brain_private_buckets",owner:"supabase_storage_admin",dependencies:[9]}]){withFixture({target:{extraRows:[row]}},fixture=>{refuse(()=>run(fixture),"SCOPE_UNSUPPORTED");});}
});
test("all original managed objects and database metadata remain in the baseline",()=>{
  withFixture({target:{overrides:{7:{definition:"-- "+CANARY}}}},fixture=>{const result=run(fixture);assert.equal(result.managed.reasons.includes("definition_mismatch"),true);assert.equal(result.existingApp.reasons.includes("definition_mismatch"),true);hidden(result);});
  const database={id:50,kind:"DATABASE",schema:"-",tag:"postgres",dependencies:[]},properties={id:51,kind:"DATABASE PROPERTIES",schema:"-",tag:"postgres",dependencies:[]},acl={id:52,kind:"ACL",schema:"-",tag:"DATABASE postgres",dependencies:[50]};
  withFixture({source:{extraRows:[database,properties,acl]},target:{extraRows:[database,properties,acl]}},fixture=>{const result=run(fixture);assert.equal(result.managed.matches,true);assert.equal(result.existingApp.matches,true);assert.equal(result.coverage.targetBaselineEntries,13);});
  withFixture({target:{extraRows:[properties]}},fixture=>{refuse(()=>run(fixture),"SCOPE_UNSUPPORTED");});
});
test("database metadata owner and dependency envelope remains as narrow as original B4",()=>{
  const database={id:50,kind:"DATABASE",schema:"-",tag:"postgres",dependencies:[]};
  for(const row of[{id:51,kind:"DATABASE PROPERTIES",schema:"-",tag:"postgres",owner:"foreign_owner",dependencies:[]},{id:52,kind:"ACL",schema:"-",tag:"DATABASE postgres",dependencies:[4]}]){withFixture({target:{extraRows:[database,row]}},fixture=>{refuse(()=>run(fixture),"SCOPE_UNSUPPORTED");});}
});
test("nonhistorical DATA and sequence state are fully counted without comparing their contents or claiming emptiness",()=>withFixture({target:{extraRows:[{id:50,kind:"TABLE DATA",schema:"storage",tag:"objects",owner:"supabase_storage_admin",dependencies:[8]},{id:51,kind:"SEQUENCE SET",schema:"auth",tag:"opaque_sequence",dependencies:[7]}]}},fixture=>{
  const result=run(fixture);assert.equal(result.managed.matches,true);assert.equal(result.existingApp.matches,true);assert.equal(result.coverage.targetStateEntries,6);assert.equal(result.coverage.targetEntries,19);assert.equal(Object.hasOwn(result,"empty"),false);
}));
test("full Auth/Storage histories reach BOTH comparisons without truncating an extra migration row",()=>{
  const storage=[{id:0,name:"initial",hash:"a".repeat(40),executed_at:null},{id:1,name:"extra",hash:"b".repeat(40),executed_at:null}];
  withFixture({targetHistories:{auth:[{version:"20240101"}],storage}},fixture=>{const result=run(fixture);assert.deepEqual(result.managed.reasons,["storage_history_mismatch"]);assert.deepEqual(result.existingApp.reasons,["storage_history_mismatch"]);assert.equal(inspectionMigrationHistoryFacts(fixture.target.historyHandle).history.storage.length,2);});
  withFixture({targetHistories:{auth:[{version:"different"}],storage:[storage[0]]}},fixture=>{assert.deepEqual(run(fixture).managed.reasons,["auth_history_mismatch"]);});
  withFixture({targetHistories:{auth:[{version:"20240101"}],storage:[{...storage[0],executed_at:"2026-10-16T00:00:00Z"}]}},fixture=>{assert.equal(run(fixture).managed.matches,true);});
});
test("five genuine namespaces are required and binding identity cannot be reconstructed from JSON or equal contents",()=>{
  const fixture=createInspectedBaselineFixture(),other=createInspectedBaselineFixture();try{
    for(let index=0;index<5;index++){for(const replacement of[{},JSON.parse(JSON.stringify(fixture.handles[index])),new Proxy({},{get(){throw Error(CANARY);}})]){const handles=[...fixture.handles];handles[index]=replacement;refuse(()=>observe(...handles),"REQUIRED");}}
    const handles=[...fixture.handles];handles[2]=other.source.historyHandle;refuse(()=>observe(...handles),"BINDING_INVALID");handles[2]=fixture.source.historyHandle;handles[4]=other.target.historyHandle;refuse(()=>observe(...handles),"BINDING_INVALID");handles[4]=fixture.target.historyHandle;handles[3]=fixture.source.tocHandle;refuse(()=>observe(...handles),"REQUIRED");refuse(()=>observe(...fixture.handles,"extra"),"REQUIRED");
  }finally{fixture.discard();other.discard();}
});
test("Source plan must correlate to the exact Source binding and preservation set",()=>{
  const fixture=createInspectedBaselineFixture(),other=createInspectedBaselineFixture({source:{overrides:{21:{definition:"-- changed"}}}});try{refuse(()=>observe(other.source.plan,...fixture.handles.slice(1)),"BINDING_INVALID");}finally{fixture.discard();other.discard();}
});
test("tamper/discard of either TOC/history refuses before publishing a stale comparison",()=>{
  for(const part of["sourceToc","targetToc","sourceHistory","targetHistory"]){withFixture({},fixture=>{
    if(part==="sourceToc")customArchiveTocFacts(fixture.source.tocHandle).records[0].definition[0]^=1;
    else if(part==="targetToc")customTargetInspectionTocFacts(fixture.target.tocHandle).records[0].definition[0]^=1;
    else if(part==="sourceHistory")migrationHistoryFacts(fixture.source.historyHandle).sourceBytes[0]^=1;
    else inspectionMigrationHistoryFacts(fixture.target.historyHandle).sourceBytes[0]^=1;
    refuse(()=>run(fixture),"BINDING_INVALID");
  });}
  for(const action of[fixture=>discardCustomArchiveToc(fixture.source.tocHandle),fixture=>discardCustomTargetInspectionToc(fixture.target.tocHandle),fixture=>discardMigrationHistory(fixture.source.historyHandle),fixture=>discardInspectionMigrationHistory(fixture.target.historyHandle)]){withFixture({},fixture=>{action(fixture);refuse(()=>run(fixture),"BINDING_INVALID");});}
});
test("ByteString buffer/length/iterator/toJSON shadows are never caller authority or executed getters",()=>withFixture({},fixture=>{
  let touches=0;const records=[...customArchiveTocFacts(fixture.source.tocHandle).records,...customTargetInspectionTocFacts(fixture.target.tocHandle).records];
  for(const row of records)for(const value of[row.tag,row.namespace,row.owner,row.definition])if(value!==null){for(const key of["buffer","byteLength","toJSON",Symbol.iterator])Object.defineProperty(value,key,{configurable:true,get(){touches++;throw Error(CANARY);}});}
  const result=run(fixture);assert.equal(result.existingApp.matches,true);assert.equal(touches,0);
}));
test("all errors/limits and results are closed and importing the fixture does not schedule tests or perform IO",()=>{
  assert.equal(Object.isFrozen(INSPECTED_BASELINE_ERROR_CODES),true);assert.equal(INSPECTED_BASELINE_ERROR_CODES.length,8);assert.equal(Object.isFrozen(INSPECTED_BASELINE_LIMITS),true);assert.equal(INSPECTED_BASELINE_LIMITS.records,10000);assert.equal(INSPECTED_BASELINE_LIMITS.tocBytes,32*1024*1024);assert.equal(observe.constructor.name,"Function");
});
