import test from 'node:test';
import assert from 'node:assert/strict';
import {copyFile,lstat,mkdir,mkdtemp,readFile,realpath,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename,isAbsolute,join,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildSqlEditor} from '../../scripts/build-sql-editor.mjs';
import {loadCanonicalMigrations,loadHistorical026Migrations,loadHistorical027FromReviewedMigrations,loadHistorical026FromReviewedMigrations} from '../../scripts/verification/auth-local-ci.mjs';
import {CURRENT27_CANONICAL_REVIEW,readCurrent27CanonicalMigrations,readHistorical026CanonicalMigrations} from '../helpers/canonical-release-source.mjs';
import {FRONT_B_30_DRAFT_REVIEW,readReviewedFrontBChain} from '../helpers/canonical-front-b-source.mjs';
const repo=fileURLToPath(new URL('../../',import.meta.url));
const candidates=['20261101020254_public_admission_gate.sql','20261101030000_signup_metrics.sql','20261101013633_feedback_requests.sql'];
const refused=code=>error=>error?.code===code&&error?.message===code;
async function staged(t,count){
 const parent=await realpath(resolve(tmpdir())),root=await mkdtemp(join(parent,'sc-auth-reviewed-chain-'));
 t.after(async()=>{
  const st=await lstat(root),actual=await realpath(root),within=relative(parent,actual);
  if(!st.isDirectory()||st.isSymbolicLink()||!within||within==='..'||within.startsWith(`..${sep}`)||isAbsolute(within)||!basename(actual).startsWith('sc-auth-reviewed-chain-'))throw Error('FIXTURE_CLEANUP_REFUSED');
  await rm(actual,{recursive:true,force:true});
 });
 await mkdir(join(root,'supabase/migrations'),{recursive:true});
 for(const m of CURRENT27_CANONICAL_REVIEW)await copyFile(join(repo,'supabase/migrations',m.file),join(root,'supabase/migrations',m.file));
 if(count===30)for(const [i,f] of candidates.entries())await copyFile(join(repo,'supabase/operations/candidates',f),join(root,'supabase/migrations',FRONT_B_30_DRAFT_REVIEW[27+i].file));
 assert.equal(buildSqlEditor({root}).migrations,count);return root;
}
async function assertPlans(root,expected27){
 const historical27=await loadHistorical027FromReviewedMigrations(root),historical26=await loadHistorical026FromReviewedMigrations(root);
 assert.equal(historical27.length,27);assert.equal(historical26.length,26);
 for(const plan of [historical27,historical26])for(const [i,row]of plan.entries()){
  assert.deepEqual(Object.keys(row),['source']);assert.ok(Buffer.isBuffer(row.source));assert.ok(row.source.equals(expected27[i].source));
 }
}
test('explicit historical 026/027 interfaces qualify entire 27 or draft30; legacy interfaces remain strict',async t=>{
 const expected=await readCurrent27CanonicalMigrations(repo),root27=await staged(t,27),root30=await staged(t,30);
 assert.equal((await readReviewedFrontBChain(root27)).state,'reviewed_27');assert.equal((await readReviewedFrontBChain(root30)).state,'draft_30');
 await assertPlans(root27,expected);await assertPlans(root30,expected);
 assert.equal((await loadCanonicalMigrations(root27)).length,27);assert.equal((await loadHistorical026Migrations(root27)).length,26);
 for(const load of [loadCanonicalMigrations,loadHistorical026Migrations])await assert.rejects(load(root30),refused('MIGRATION_MANIFEST_REFUSED'));
 await assert.rejects(readCurrent27CanonicalMigrations(root30),refused('MIGRATION_MANIFEST_REFUSED'));
 await assert.rejects(readHistorical026CanonicalMigrations(root30),refused('MIGRATION_MANIFEST_REFUSED'));
});
test('no historical plan survives corruption of any draft30 candidate or a 27-tail mismatch',async t=>{
 const root=await staged(t,30),loaders=[loadHistorical027FromReviewedMigrations,loadHistorical026FromReviewedMigrations];
 for(let i=27;i<30;i++){
  const file=FRONT_B_30_DRAFT_REVIEW[i].file,source=join(root,'supabase/migrations',file),copy=join(root,'supabase/sql-editor/installation',`${String(i+1).padStart(3,'0')}_${file}`),a=await readFile(source),b=await readFile(copy),bad=Buffer.from(a);bad[0]^=1;
  try{await writeFile(source,bad);await writeFile(copy,bad);for(const load of loaders)await assert.rejects(load(root),refused('MIGRATION_INTEGRITY_FAILED'));}
  finally{await writeFile(source,a);await writeFile(copy,b);}
 }
 const manifestPath=join(root,'supabase/sql-editor/manifest.json'),bytes=await readFile(manifestPath),value=JSON.parse(bytes);value.installation.pop();
 try{await writeFile(manifestPath,JSON.stringify(value));for(const load of loaders)await assert.rejects(load(root),refused('MIGRATION_MANIFEST_REFUSED'));}finally{await writeFile(manifestPath,bytes);}
 const truncated=JSON.parse(bytes);truncated.installation=truncated.installation.slice(0,27);
 try{await writeFile(manifestPath,JSON.stringify(truncated));for(const load of loaders)await assert.rejects(load(root),refused('MIGRATION_MANIFEST_REFUSED'));}finally{await writeFile(manifestPath,bytes);}
 const copy=join(root,'supabase/sql-editor/installation',`030_${FRONT_B_30_DRAFT_REVIEW[29].file}`),copyBytes=await readFile(copy);
 try{await writeFile(copy,Buffer.concat([copyBytes,Buffer.from('-- drift\n')]));for(const load of loaders)await assert.rejects(load(root),refused('MIGRATION_INTEGRITY_FAILED'));}finally{await writeFile(copy,copyBytes);}
 const extra=join(root,'supabase/migrations/20990101000000_extra.sql');
 try{await writeFile(extra,'-- extra\n');for(const load of loaders)await assert.rejects(load(root),refused('MIGRATION_MANIFEST_REFUSED'));}finally{await rm(extra,{force:true});}
 const r27=await staged(t,27),m=CURRENT27_CANONICAL_REVIEW[26],s=join(r27,'supabase/migrations',m.file),c=join(r27,'supabase/sql-editor/installation',`027_${m.file}`),a=await readFile(s),b=await readFile(c),bad=Buffer.from(a);bad[0]^=1;
 try{await writeFile(s,bad);await writeFile(c,bad);for(const load of [...loaders,loadCanonicalMigrations,loadHistorical026Migrations])await assert.rejects(load(r27),refused('MIGRATION_INTEGRITY_FAILED'));}finally{await writeFile(s,a);await writeFile(c,b);}
 for(const load of loaders)await assert.rejects(load('relative'),refused('SOURCE_FILE_REFUSED'));
});
