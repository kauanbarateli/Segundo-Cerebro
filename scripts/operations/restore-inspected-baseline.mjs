import { createHash } from "node:crypto";
import { types } from "node:util";
import { BackupError } from "./backup-format.mjs";
import { managedRestoreRequirements } from "./restore-managed-plan.mjs";
import { customArchiveTocFacts, customTargetInspectionTocFacts } from "./restore-custom-toc.mjs";
import { migrationHistoryFacts, inspectionMigrationHistoryFacts } from "./restore-migration-history.mjs";
import { compareManagedBaseline, MANAGED_BASELINE_ERROR_CODES, MANAGED_BASELINE_LIMITS } from "./restore-managed-baseline.mjs";

// Pure observation policy v1. Five nominal handles only; no IO, replay list,
// native provenance, target preparation, capability mint or restore authority.
const apply=Reflect.apply,uncurry=fn=>(self,...args)=>apply(fn,self,args),freeze=Object.freeze;
const descriptor=Object.getOwnPropertyDescriptor,hasOwn=Object.hasOwn,isSafe=Number.isSafeInteger;
const Bytes=Uint8Array,View=DataView,typed=Object.getPrototypeOf(Bytes.prototype),intrinsic=key=>uncurry(descriptor(typed,key).get);
const tagOf=intrinsic(Symbol.toStringTag),lengthOf=intrinsic("byteLength"),bufferOf=intrinsic("buffer"),offsetOf=intrinsic("byteOffset"),charCode=uncurry(String.prototype.charCodeAt);
const hashPrototype=Object.getPrototypeOf(createHash("sha256")),hashUpdate=uncurry(hashPrototype.update),hashDigest=uncurry(hashPrototype.digest),newHash=createHash;
const ownErrors=new WeakSet(),trustedA2Errors=new WeakSet();
const gapDiagnostics=new WeakMap(),gapGet=uncurry(WeakMap.prototype.get),gapSet=uncurry(WeakMap.prototype.set);
const GAP_DETAILS=8,GAP_HASH_BYTES=1024*1024;
export const INSPECTED_BASELINE_ERROR_CODES=freeze(["RESTORE_INSPECTED_BASELINE_REQUIRED","RESTORE_INSPECTED_BASELINE_BINDING_INVALID","RESTORE_INSPECTED_BASELINE_SCOPE_UNSUPPORTED","RESTORE_INSPECTED_BASELINE_LIMIT_EXCEEDED","RESTORE_INSPECTED_BASELINE_AMBIGUOUS",...MANAGED_BASELINE_ERROR_CODES]);
export const INSPECTED_BASELINE_LIMITS=MANAGED_BASELINE_LIMITS;
const fail=suffix=>{const error=new BackupError("RESTORE_INSPECTED_BASELINE_"+suffix);ownErrors.add(error);throw error;};
const byteFields=["tag","namespace","definition","dropStatement","copyStatement","tablespace","tableAccessMethod","owner","withOids"];
const globals=new Set(["ENCODING","STDSTRINGS","SEARCHPATH"]),appKinds=new Set(["FUNCTION","ACL","DEFAULT ACL"]);
const forbiddenCustom=[
  ["TRIGGER","auth","users second_brain_identity_created"],["TRIGGER","auth","users second_brain_admin_creation_final"],
  ["POLICY","storage","objects second_brain_private_objects"],["POLICY","storage","buckets second_brain_private_buckets"],
];
function nominal(getter,handle){
  try{return getter(handle);}catch(error){
    let code;try{if(error&&!types.isProxy(error)&&error instanceof BackupError){const d=descriptor(error,"code");if(d&&hasOwn(d,"value"))code=d.value;}}catch{/* No provider getter. */}
    fail(typeof code==="string"&&/(?:BINDING_INVALID|DISCARDED)$/.test(code)?"BINDING_INVALID":"REQUIRED");
  }
}
function bytes(value,budget){
  if(value===null)return null;
  if(!value||types.isProxy(value)||typeof value!=="object")fail("BINDING_INVALID");
  let buffer,length,offset;
  try{if(tagOf(value)!=="Uint8Array")fail("BINDING_INVALID");buffer=bufferOf(value);if(types.isSharedArrayBuffer(buffer))fail("BINDING_INVALID");new View(buffer,0,0);length=lengthOf(value);offset=offsetOf(value);}catch(error){if(ownErrors.has(error))throw error;fail("BINDING_INVALID");}
  if(length>INSPECTED_BASELINE_LIMITS.fieldBytes||budget.bytes+length>INSPECTED_BASELINE_LIMITS.tocBytes)fail("LIMIT_EXCEEDED");budget.bytes+=length;
  return new Bytes(buffer,offset,length);
}
function equal(a,b){if(a===null||b===null)return a===b;const length=lengthOf(a);if(length!==lengthOf(b))return false;for(let i=0;i<length;i++)if(a[i]!==b[i])return false;return true;}
function ascii(a,text){if(a===null||lengthOf(a)!==text.length)return false;for(let i=0;i<text.length;i++)if(a[i]!==charCode(text,i))return false;return true;}
function identityEqual(a,b){return a.kind===b.kind&&equal(a.namespace,b.namespace)&&equal(a.tag,b.tag)&&(a.kind!=="DEFAULT ACL"||equal(a.owner,b.owner));}
function identityKey(row){
  const hash=newHash("sha256");hashUpdate(hash,row.kind+":");
  for(const part of row.kind==="DEFAULT ACL"?[row.namespace,row.tag,row.owner]:[row.namespace,row.tag]){hashUpdate(hash,part===null?"N;":"B"+lengthOf(part)+":");if(part!==null)hashUpdate(hash,part);}
  return hashDigest(hash,"hex");
}
function scan(facts){
  if(facts.records.length>INSPECTED_BASELINE_LIMITS.records)fail("LIMIT_EXCEEDED");
  const budget={bytes:0,dependencies:0},rows=[],byId=new Map(),buckets=new Map();
  for(const row of facts.records){
    if(!isSafe(row.dumpId)||row.dumpId<1||!isSafe(row.ordinal)||row.ordinal<0||row.ordinal>=facts.records.length||facts.records[row.ordinal]!==row||byId.has(row.dumpId))fail("BINDING_INVALID");
    if(row.dependencies.length>INSPECTED_BASELINE_LIMITS.dependencies-budget.dependencies)fail("LIMIT_EXCEEDED");budget.dependencies+=row.dependencies.length;
    const entry={row,kind:row.kind};for(const key of byteFields){const view=bytes(row[key],budget);if(["tag","namespace","owner"].includes(key))entry[key]=view;}
    const key=identityKey(entry),bucket=buckets.get(key)??[];entry.key=key;
    for(const previous of bucket)if(identityEqual(previous,entry))fail("AMBIGUOUS");
    bucket.push(entry);buckets.set(key,bucket);byId.set(row.dumpId,entry);rows.push(entry);
  }
  return {rows,byId,buckets};
}
function sourceBinding(requirements,facts){
  const binding=facts.binding;
  if(binding.side!=="archive"||requirements.archiveSha256!==binding.archiveSha256||requirements.databaseSha256!==binding.databaseSha256||requirements.databaseBytes!==binding.databaseBytes||requirements.tocSha256!==binding.tocSha256)fail("BINDING_INVALID");
  if(requirements.preserved.length!==facts.preserved.length)fail("BINDING_INVALID");
  const wanted=new Set(requirements.preserved.map(row=>row.id));
  if(wanted.size!==requirements.preserved.length||facts.preserved.some(row=>!wanted.has(row.dumpId)))fail("BINDING_INVALID");
}
function partition(target){
  const baseline=[],state=[],app=[],seenGlobals=new Set(),seenHistories=new Set(),databaseMetadata=new Map();
  const unsupported=()=>fail("SCOPE_UNSUPPORTED");
  for(const entry of target.rows){
    const {row,kind,namespace,tag,owner}=entry,isGlobal=namespace===null;
    if(["DATABASE","DATABASE PROPERTIES"].includes(kind)||isGlobal&&["ACL","COMMENT"].includes(kind)&&ascii(tag,"DATABASE postgres")){
      if(!isGlobal||owner===null||lengthOf(owner)===0||!ascii(tag,["ACL","COMMENT"].includes(kind)?"DATABASE postgres":"postgres"))unsupported();
      if(databaseMetadata.has(kind))fail("AMBIGUOUS");databaseMetadata.set(kind,entry);baseline.push(row);continue;
    }
    if(forbiddenCustom.some(([k,s,t])=>kind===k&&ascii(namespace,s)&&ascii(tag,t)))unsupported();
    if(isGlobal&&globals.has(kind)){if(seenGlobals.has(kind))fail("AMBIGUOUS");seenGlobals.add(kind);state.push(row);continue;}
    if(ascii(namespace,"auth")||ascii(namespace,"storage")){
      if(["DATABASE","DATABASE PROPERTIES","SCHEMA","ENCODING","STDSTRINGS","SEARCHPATH"].includes(kind))unsupported();
      if(kind==="TABLE DATA"){
        const history=ascii(namespace,"auth")&&ascii(tag,"schema_migrations")?"auth":ascii(namespace,"storage")&&ascii(tag,"migrations")?"storage":null;
        if(history){if(seenHistories.has(history))fail("AMBIGUOUS");seenHistories.add(history);baseline.push(row);}else state.push(row);
      }else if(kind==="SEQUENCE SET")state.push(row);else baseline.push(row);
      continue;
    }
    const schemaName=["auth","storage","public"].some(name=>ascii(tag,name)),schemaAclName=["auth","storage","public"].some(name=>ascii(tag,name)||ascii(tag,"SCHEMA "+name));
    if(isGlobal&&(kind==="SCHEMA"&&schemaName||["ACL","COMMENT"].includes(kind)&&schemaAclName)){baseline.push(row);continue;}
    if(ascii(namespace,"public")&&appKinds.has(kind)){app.push(entry);continue;}
    unsupported();
  }
  const database=databaseMetadata.get("DATABASE");if(databaseMetadata.size&&!database)unsupported();
  for(const entry of databaseMetadata.values()){
    const dependent=["ACL","COMMENT"].includes(entry.kind),deps=entry.row.dependencies;
    if(!equal(entry.owner,database.owner)||deps.length!==(dependent?1:0)||dependent&&deps[0]!==database.row.dumpId)unsupported();
  }
  if(seenGlobals.size!==3||seenHistories.size!==2||baseline.length+state.length+app.length!==target.rows.length)unsupported();
  return {baseline,state,app};
}
function compare(left,right){
  try{return compareManagedBaseline(left,right);}catch(error){
    try{const d=error&&!types.isProxy(error)&&error instanceof BackupError?descriptor(error,"code"):null;if(d&&hasOwn(d,"value")&&MANAGED_BASELINE_ERROR_CODES.includes(d.value)){trustedA2Errors.add(error);throw error;}}catch(original){if(trustedA2Errors.has(original))throw original;}
    fail("BINDING_INVALID");
  }
}

// Diagnostic-only correspondences reuse the already validated identity buckets.
// Original full bytes still decide the pair; neither hashes nor this projection
// are supplied to A2, a baseline qualifier, a receipt or a capability mint.
function pairedContext(sourceRows,targetRows,sourceAll,targetAll){
  const left=new Map(sourceRows.map(row=>[row.dumpId,sourceAll.byId.get(row.dumpId)]));
  const right=new Map(targetRows.map(row=>[row.dumpId,targetAll.byId.get(row.dumpId)]));
  const buckets=new Map(),pairs=[],mapping=new Map(),inverse=new Map();
  for(const entry of right.values()){const bucket=buckets.get(entry.key)??[];bucket.push(entry);buckets.set(entry.key,bucket);}
  for(const entry of left.values()){
    const candidates=buckets.get(entry.key)??[];let partner=null;
    for(const candidate of candidates)if(identityEqual(entry,candidate)){if(partner)fail("AMBIGUOUS");partner=candidate;}
    if(partner){pairs.push([entry,partner]);mapping.set(entry.row.dumpId,partner.row.dumpId);inverse.set(partner.row.dumpId,entry.row.dumpId);}
  }
  return {left,right,pairs,mapping,inverse};
}
function dependencyGap(source,target,context){
  const a=source.row.dependencies,b=target.row.dependencies;let first=null,comparable=true;
  for(const id of a)if(!context.left.has(id)||!context.mapping.has(id))comparable=false;
  for(const id of b)if(!context.right.has(id)||!context.inverse.has(id))comparable=false;
  for(let index=0;index<Math.min(a.length,b.length);index++){
    // Exactly A2's ordered predicate, including its separate unsupported-scope
    // reason. An unresolved edge alone is not invented as a vector mismatch.
    if(context.left.has(a[index])&&context.right.has(b[index])&&context.mapping.get(a[index])!==b[index]){first=index;break;}
  }
  if(first===null&&a.length!==b.length)first=Math.min(a.length,b.length);
  if(first===null)return null;
  let multiset=null;
  if(comparable){
    const counts=new Map();for(const id of a){const mapped=context.mapping.get(id);counts.set(mapped,(counts.get(mapped)??0)+1);}
    for(const id of b)counts.set(id,(counts.get(id)??0)-1);
    multiset=a.length===b.length&&[...counts.values()].every(value=>value===0);
  }
  return {sourceCount:a.length,targetCount:b.length,sourceUnique:new Set(a).size,targetUnique:new Set(b).size,firstDifferentIndex:first,vectorsComparable:comparable,mappedMultisetEqual:multiset};
}
function identityHashBytes(entry){
  let count=entry.kind.length+1;
  for(const part of entry.kind==="DEFAULT ACL"?[entry.namespace,entry.tag,entry.owner]:[entry.namespace,entry.tag])count+=part===null?2:2+String(lengthOf(part)).length+lengthOf(part);
  return count;
}
function dependencyAt(entry,index,context,side){
  if(index>=entry.row.dependencies.length)return {state:"end",entry:null};
  const id=entry.row.dependencies[index],records=side==="source"?context.left:context.right,mapping=side==="source"?context.mapping:context.inverse;
  return records.has(id)&&mapping.has(id)?{state:"identity",entry:records.get(id)}:{state:"unresolved",entry:null};
}
function emitIdentity(observation,budget){
  if(!observation.entry)return freeze({state:observation.state,identitySha256:null});
  budget.bytes+=identityHashBytes(observation.entry);
  return freeze({state:"identity",identitySha256:identityKey(observation.entry)});
}
function definitionSide(value,budget,omissions){
  if(value===null)return freeze({state:"null",bytes:null,sha256:null,hashStatus:"null"});
  const length=lengthOf(value);
  if(length>GAP_HASH_BYTES-budget.bytes){omissions.definitionHashes++;return freeze({state:"bytes",bytes:length,sha256:null,hashStatus:"omitted_limit"});}
  budget.bytes+=length;
  return freeze({state:"bytes",bytes:length,sha256:hashDigest(hashUpdate(newHash("sha256"),value),"hex"),hashStatus:"complete"});
}
function scopeOf(entry){
  if(entry.namespace===null)return "global";
  for(const scope of["auth","storage","public"])if(ascii(entry.namespace,scope))return scope;
  fail("SCOPE_UNSUPPORTED");
}
function gapGroup(context,pairs,budget){
  const kinds=new Map(),details=[],omissions={detailLimitRows:0,hashBudgetRows:0,definitionHashes:0};
  const dependencyVectorSummary={comparableRows:0,nonComparableRows:0,mappedMultisetEqualRows:0,mappedMultisetDifferentRows:0};
  let dependencyMismatchRows=0,definitionMismatchRows=0,gapRows=0;
  // Source ordinal fixes diagnostic selection only; no dependency vector is
  // sorted, deduplicated, truncated or passed back into the comparison.
  const ordered=[...pairs].sort((a,b)=>a[0].row.ordinal-b[0].row.ordinal);
  for(const [source,target]of ordered){
    const dependencies=dependencyGap(source,target,context),definitionMismatch=!equal(source.row.definition,target.row.definition);
    const counts=kinds.get(source.kind)??{kind:source.kind,pairedRecords:0,dependencyMismatchRows:0,definitionMismatchRows:0};counts.pairedRecords++;
    if(dependencies){
      dependencyMismatchRows++;counts.dependencyMismatchRows++;
      // Aggregate every original mismatch before either diagnostic omission.
      // A multiset classification never changes A2's ordered predicate.
      if(dependencies.vectorsComparable){
        dependencyVectorSummary.comparableRows++;
        if(dependencies.mappedMultisetEqual===true)dependencyVectorSummary.mappedMultisetEqualRows++;
        else if(dependencies.mappedMultisetEqual===false)dependencyVectorSummary.mappedMultisetDifferentRows++;
        else fail("BINDING_INVALID");
      }else{
        if(dependencies.mappedMultisetEqual!==null)fail("BINDING_INVALID");
        dependencyVectorSummary.nonComparableRows++;
      }
    }
    if(definitionMismatch){definitionMismatchRows++;counts.definitionMismatchRows++;}
    kinds.set(source.kind,counts);
    if(!dependencies&&!definitionMismatch)continue;
    gapRows++;
    if(details.length===GAP_DETAILS){omissions.detailLimitRows++;continue;}
    const atSource=dependencies?dependencyAt(source,dependencies.firstDifferentIndex,context,"source"):null;
    const atTarget=dependencies?dependencyAt(target,dependencies.firstDifferentIndex,context,"target"):null;
    const required=identityHashBytes(source)+(atSource?.entry?identityHashBytes(atSource.entry):0)+(atTarget?.entry?identityHashBytes(atTarget.entry):0);
    if(required>GAP_HASH_BYTES-budget.bytes){omissions.hashBudgetRows++;continue;}
    budget.bytes+=identityHashBytes(source);
    const detail={kind:source.kind,scope:scopeOf(source),identitySha256:identityKey(source),dependencies:dependencies?freeze({...dependencies,sourceAtFirst:emitIdentity(atSource,budget),targetAtFirst:emitIdentity(atTarget,budget)}):null,
      definitionGap:definitionMismatch?freeze({source:definitionSide(source.row.definition,budget,omissions),target:definitionSide(target.row.definition,budget,omissions)}):null};
    details.push(freeze(detail));
  }
  const byKind=[...kinds.values()].sort((a,b)=>a.kind<b.kind?-1:a.kind>b.kind?1:0).map(freeze);
  if(dependencyVectorSummary.comparableRows+dependencyVectorSummary.nonComparableRows!==dependencyMismatchRows||dependencyVectorSummary.mappedMultisetEqualRows+dependencyVectorSummary.mappedMultisetDifferentRows!==dependencyVectorSummary.comparableRows)fail("BINDING_INVALID");
  return freeze({pairedRecords:pairs.length,dependencyMismatchRows,dependencyVectorSummary:freeze(dependencyVectorSummary),definitionMismatchRows,byKind:freeze(byKind),details:freeze(details),omittedDetailRows:gapRows-details.length,omissions:freeze(omissions)});
}
function collectGapDiagnostic(sourceRows,targetRows,sourceUnion,parts,sourceAll,targetAll){
  const managedContext=pairedContext(sourceRows,targetRows,sourceAll,targetAll);
  const unionContext=pairedContext(sourceUnion,[...parts.baseline,...parts.app.map(entry=>entry.row)],sourceAll,targetAll);
  const publicIds=new Set(parts.app.map(entry=>entry.row.dumpId)),budget={bytes:0};
  const managed=gapGroup(managedContext,managedContext.pairs,budget);
  const added=gapGroup(unionContext,unionContext.pairs.filter(([,target])=>publicIds.has(target.row.dumpId)),budget);
  return freeze({version:2,countsFull:true,hashBytes:budget.bytes,managed,added_public:added});
}

/** Only the exact original observation owns a sanitized projection. Clones,
 * proxies and caller descriptors are not read. This is never a live handle. */
export function inspectedBaselineGapDiagnostic(observation){
  if(arguments.length!==1)fail("REQUIRED");
  const result=gapGet(gapDiagnostics,observation);if(!result)fail("REQUIRED");return result;
}

/** Same-process observation from five live nominal stores only. It never
 * changes a Source plan or creates a B4/restore handle from inspection facts. */
export function observeInspectedManagedBaseline(sourcePlan,sourceToc,sourceHistory,targetInspectionToc,targetInspectionHistory){
  try{
    if(arguments.length!==5)fail("REQUIRED");
    const requirements=nominal(managedRestoreRequirements,sourcePlan),source=nominal(customArchiveTocFacts,sourceToc),leftHistory=nominal(migrationHistoryFacts,sourceHistory),target=nominal(customTargetInspectionTocFacts,targetInspectionToc),rightHistory=nominal(inspectionMigrationHistoryFacts,targetInspectionHistory);
    sourceBinding(requirements,source);
    if(leftHistory.binding!==source.binding||rightHistory.binding!==target.binding||target.binding.side!=="target-inspection")fail("BINDING_INVALID");
    const allSource=scan(source),allTarget=scan(target),parts=partition(allTarget),sourceUnion=[...source.preserved],included=new Set(source.preserved.map(row=>row.dumpId));let counterparts=0;
    for(const candidate of parts.app){
      const bucket=allSource.buckets.get(identityKey(candidate))??[];let matched=null;
      for(const entry of bucket)if(identityEqual(entry,candidate)){if(matched)fail("AMBIGUOUS");matched=entry.row;}
      if(matched){counterparts++;if(!included.has(matched.dumpId)){included.add(matched.dumpId);sourceUnion.push(matched);}}
      // A missing counterpart remains in the target DTO. A2 must report it;
      // filtering to expected Source identities would conceal target extras.
    }
    const targetBinding=freeze({side:"target",projectRef:target.binding.projectRef,databaseName:target.binding.databaseName,nativeDumpSha256:target.binding.nativeDumpSha256,nativeDumpBytes:target.binding.nativeDumpBytes,tocSha256:target.binding.tocSha256});
    const left=preserved=>({version:1,binding:source.binding,preserved,histories:leftHistory.history}),right=preserved=>({version:1,binding:targetBinding,preserved,histories:rightHistory.history});
    const managed=compare(left(source.preserved),right(parts.baseline));
    const existingApp=compare(left(sourceUnion),right([...parts.baseline,...parts.app.map(entry=>entry.row)]));
    const gapDiagnostic=collectGapDiagnostic(source.preserved,parts.baseline,sourceUnion,parts,allSource,allTarget);
    // No await or caller callback. Final nominal getters recheck owned bytes
    // and binding identities after both synchronous comparisons.
    sourceBinding(nominal(managedRestoreRequirements,sourcePlan),source);
    if(nominal(customArchiveTocFacts,sourceToc)!==source||nominal(migrationHistoryFacts,sourceHistory)!==leftHistory||nominal(customTargetInspectionTocFacts,targetInspectionToc)!==target||nominal(inspectionMigrationHistoryFacts,targetInspectionHistory)!==rightHistory)fail("BINDING_INVALID");
    const result=freeze({version:1,managed,existingApp,coverage:freeze({sourceEntries:allSource.rows.length,sourcePreservedEntries:source.preserved.length,targetEntries:allTarget.rows.length,targetBaselineEntries:parts.baseline.length,targetStateEntries:parts.state.length,targetAppEntries:parts.app.length,sourceAppCounterparts:counterparts,coverageComplete:true}),inspectionOnly:true,baselineQualified:false,restoreAccepted:false});
    gapSet(gapDiagnostics,result,gapDiagnostic);return result;
  }catch(error){if(ownErrors.has(error)||trustedA2Errors.has(error))throw error;fail("BINDING_INVALID");}
}
