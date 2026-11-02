import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyGeneratorSources,verifyBinding} from './source-binding.mjs';
const root=resolve(existsSync('scripts/verification/auth-local-ci.mjs')?'.':'work/Segundo-Cerebro');
const rd=p=>readFileSync(resolve(root,p));
const own=p=>readFileSync(new URL('./'+p,import.meta.url));
const inputs={generatorBytes:rd('scripts/verification/front-b-metrics-dictionary-draft/generate.mjs'),pathsBytes:rd('scripts/verification/front-b-metrics-dictionary-draft/paths.mjs'),dictionaryBytes:rd('scripts/verification/front-b-metrics-dictionary-draft/origin-dictionary.json'),baseBytes:rd('supabase/operations/candidates/20261101030000_signup_metrics.sql'),candidateBytes:own('candidate.sql.txt'),proposalBytes:own('reviewed-proposal.sql.txt')};
const {compileDictionary}=await import(pathToFileURL(resolve(root,'scripts/verification/front-b-metrics-dictionary-draft/generate.mjs')).href);
const source=({generatorBytes,pathsBytes,dictionaryBytes,baseBytes})=>({generatorBytes,pathsBytes,dictionaryBytes,baseBytes});
test('reviewed proposal is generated exactly from pinned source and dictionary',()=>{
 assert.doesNotThrow(()=>verifyGeneratorSources(source(inputs)));assert.doesNotThrow(()=>verifyBinding(inputs,compileDictionary));
});
test('refuses mutation in any source, candidate or proposal, even if both copies match',()=>{
 for(const key of Object.keys(inputs)){
  const b=Buffer.from(inputs[key]);b[0]^=1;
  assert.throws(()=>verifyBinding({...inputs,[key]:b},compileDictionary),/SYNTHETIC_BINDING_REFUSED/);
  if(['generatorBytes','pathsBytes','dictionaryBytes','baseBytes'].includes(key))assert.throws(()=>verifyGeneratorSources(source({...inputs,[key]:b})),/SYNTHETIC_BINDING_REFUSED/);
 }
 const changed=Buffer.from(inputs.candidateBytes);changed[changed.length-4]^=1;
 assert.throws(()=>verifyBinding({...inputs,candidateBytes:changed,proposalBytes:changed},compileDictionary),/SYNTHETIC_BINDING_REFUSED/);
});
test('rejects compiler drift, unexpected fields and malformed inputs',()=>{
 assert.throws(()=>verifyBinding({...inputs,extra:true},compileDictionary));
 assert.throws(()=>verifyBinding({...inputs,proposalBytes:null},compileDictionary));
 assert.throws(()=>verifyBinding(inputs,()=>({version:'sha256:bad',sql:'bad'})));
 assert.throws(()=>verifyBinding(inputs,()=>({...compileDictionary(inputs.dictionaryBytes),sql:'bad'})));
});
