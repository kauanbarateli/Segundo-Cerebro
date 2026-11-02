// Local deterministic composition only. Never executes SQL or changes the ledger.
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const scratch="DO $scratch_guard$ BEGIN RAISE EXCEPTION 'UNREVIEWED SCRATCH SQL: DO NOT APPLY'; END $scratch_guard$;";
const rollout="DO $rollout_block$ BEGIN RAISE EXCEPTION 'CLEANUP_WRITERS_NOT_PROVEN_PAUSED_AND_DRAINED'; END $rollout_block$;";
function removeOnce(source,token) {
 if(source.split(token).length!==2) throw new Error(`Expected exactly one ${token}`);
 return source.replace(token,'');
}
export async function composeCandidate() {
 const paths=['same-browser-signup.guarded.sql.txt','same-browser-retention.guarded.sql.txt'];
 const sources=await Promise.all(paths.map(path=>readFile(new URL(path,import.meta.url),'utf8')));
 const hashes=sources.map(source=>createHash('sha256').update(source).digest('hex'));
 const sections=sources.map((source,index)=>{
  let s=removeOnce(removeOnce(removeOnce(source,'BEGIN;\n'),scratch),'COMMIT;');
  if(index===1) s=removeOnce(s,rollout);
  return s.trim();
 });
 return `-- VERSIONED COMPOSITION V1: REVIEW CANDIDATE ONLY; NEVER APPLY.\n-- Generated from ${paths[0]} sha256 ${hashes[0]}\n-- Generated from ${paths[1]} sha256 ${hashes[1]}\nBEGIN;\n${scratch}\n${rollout}\n\n${sections[0]}\n\n${sections[1]}\nCOMMIT;\n`;
}
export {scratch,rollout};
