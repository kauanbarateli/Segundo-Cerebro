// REVIEW DRAFT ONLY. Pure checks, not a native runner and not release evidence.
// There is deliberately no subprocess, filesystem, SQL or network entrypoint.
import {createHash} from 'node:crypto';

const fail=()=>{throw new Error('OBSERVATION_REFUSED');};
const hash=b=>createHash('sha256').update(b).digest('hex');
const KEY=/^[a-f0-9]{64}$/;
const plain=(value,keys)=>{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)return false;
 const d=Object.getOwnPropertyDescriptors(value),names=Reflect.ownKeys(d);
 return names.length===keys.length&&names.every(k=>typeof k==='string'&&keys.includes(k))&&keys.every(k=>d[k]?.enumerable&&Object.hasOwn(d[k],'value'));
};
export const OBSERVATION_PINS=Object.freeze([
 ['supabase/operations/onboarding-conflict-code.sql',2441,'4ba6a09351e60504cbc6e5fe6500e5e70045fc6d07012f2e375704ca6bc77bba'],
 ['supabase/operations/candidates/20261101020254_public_admission_gate.sql',31936,'e125759742d7fa1513f7d42ad04ee13c1a6c8894b98478261d1217381f93f519'],
 ['supabase/operations/candidates/20261101030000_signup_metrics.sql',3675,'55b72a3a566af68e4795b367707cda5745c70321e0186b1536fe6f63bdc3dd5f'],
 ['supabase/operations/candidates/20261101013633_feedback_requests.sql',4581,'736a9113322317e63e676a4554f6f57231becc9d67065c7f95c97572ad0cc9d6'],
 ['supabase/operations/verify-onboarding-conflict-code.sql',2018,'e7596b4d031c20bd1a367ad838524c536965e7dc9f5c52ad8a638ce5400e1514'],
 ['supabase/operations/verify-front-b-additive.sql',25611,'90f3f21496e91b71aa9b1842cb4975c4d79ffe0abd73d7a707bb70a13387daa9'],
 ['supabase/operations/verify-front-b-signup-disabled.sql',392,'ac2324089a6da1f55205de976987fa8634c4718a13cd4486cfd56a4abd3f5282'],
 ['supabase/tests/release-catalog.sql',207834,'19b5f158dfd2003fa89285df99f4ab2e0287ee411b07b9a6b0bc7e6fb82f6e9e'],
].map(([path,bytes,sha256])=>Object.freeze({path,bytes,sha256})));

/** Byte checks only: caller must separately bind all sources to a Git SHA. */
export function verifyObservationSources(rows){
 if(!Array.isArray(rows)||Object.getPrototypeOf(rows)!==Array.prototype||rows.length!==OBSERVATION_PINS.length)fail();
 const d=Object.getOwnPropertyDescriptors(rows);if(Reflect.ownKeys(d).length!==rows.length+1||OBSERVATION_PINS.some((_,i)=>!d[i]?.enumerable||!Object.hasOwn(d[i],'value')))fail();
 return Object.freeze(OBSERVATION_PINS.map((_,i)=>{const row=d[i].value;
  const pin=OBSERVATION_PINS[i];if(!plain(row,['path','source'])||row.path!==pin.path||!Buffer.isBuffer(row.source)||row.source.length!==pin.bytes||hash(row.source)!==pin.sha256)fail();
  return Object.freeze({path:pin.path,source:Buffer.from(row.source)});
 }));
}
/** Requires original closed PG17 ledger with all 27 exact versions and names. */
export function verifyHistoricalLedger(value,systemIdentifier,migrations){
 if(!Array.isArray(migrations)||migrations.length!==27||migrations.some(row=>typeof row?.file!=='string'||!/^\d{14}_[a-z0-9_]+\.sql$/.test(row.file)))fail();
 if(!plain(value,['bound','noAuthFixtures','systemIdentifier','ledger'])||value.bound!==true||value.noAuthFixtures!==true||value.systemIdentifier!==systemIdentifier||!/^\d{16,20}$/.test(systemIdentifier)||!Array.isArray(value.ledger)||value.ledger.length!==27)fail();
 for(const [i,row] of value.ledger.entries()){
  const file=migrations[i].file;
  if(!plain(row,['version','name','statementCount','statementHash'])||row.version!==file.slice(0,14)||row.name!==file.slice(15,-4)||!Number.isSafeInteger(row.statementCount)||row.statementCount<1||!KEY.test(row.statementHash))fail();
 }
 return JSON.stringify(value);
}
/** Exact serialized equality proves neither the target nor native execution. */
export function verifyLedgerUnchanged(before,after,systemIdentifier,migrations){if(verifyHistoricalLedger(before,systemIdentifier,migrations)!==verifyHistoricalLedger(after,systemIdentifier,migrations))fail();}
/** Cleanup is only a necessary condition, never native provenance by itself. */
export function requireCleanupProof(value){
 const fields=['processesQuiescent','namespaceAbsent','directoriesAbsent','groupConfirmed'];
 if(!plain(value,fields)||fields.some(key=>value[key]!==true))fail();
}
/** Keep the PG17 result observational; no PG18 snapshot is an acceptance gate. */
export function observeCatalogue(value,serverVersion){
 if(!Number.isSafeInteger(serverVersion)||serverVersion<170000||serverVersion>=180000||!plain(value,['version','ok','checks','deviations'])||value.version!==1||typeof value.ok!=='boolean'||!Number.isSafeInteger(value.checks)||value.checks<1||!Array.isArray(value.deviations)||value.deviations.length>1024||value.ok!==(value.deviations.length===0))fail();
 for(const item of value.deviations)if(!plain(item,['check','object'])||typeof item.check!=='string'||typeof item.object!=='string'||!item.check.length||!item.object.length)fail();
 return Object.freeze({serverVersion,checks:value.checks,ok:value.ok,deviations:value.deviations.length,accepted:false});
}

/** The scratch copy cannot run; integration must place both files under Git. */
export function validateIntegratedPaths(runnerPath,contractPath){
 if(runnerPath!=='scripts/verification/front-b-native-observation/runner.mjs'||contractPath!=='scripts/verification/front-b-native-observation/contract.mjs')fail();
}

/** Additional to container-ID validation: never accept wildcard-published ports. */
export function requireLoopbackBindings(rows){
 if(!Array.isArray(rows)||rows.length!==5)fail();
 for(const [i,key,port] of [[0,'5432/tcp','54322'],[1,'8000/tcp','54321']]){
  const bindings=rows[i]?.ports?.[key];
  if(!Array.isArray(bindings)||!bindings.length||bindings.some(row=>!plain(row,['HostIp','HostPort'])||row.HostIp!=='127.0.0.1'||row.HostPort!==port))fail();
 }
}
/** Necessary comparison only: callers must obtain both identities independently. */
export function requireSameInstance(hostIdentifier,containerIdentifier){
 if(typeof hostIdentifier!=='string'||!/^\d{16,20}$/.test(hostIdentifier)||hostIdentifier!==containerIdentifier)fail();
}
/** Disabled until CLI migration writes have same-session bound provenance. */
export function requireReviewedWriteBoundary(){fail();}
