import test from 'node:test';
import assert from 'node:assert/strict';
import {copyFile,lstat,mkdir,mkdtemp,readFile,realpath,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename,isAbsolute,join,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildSqlEditor} from '../../scripts/build-sql-editor.mjs';
import {CURRENT27_CANONICAL_REVIEW,readCurrent27CanonicalMigrations} from '../helpers/canonical-release-source.mjs';
import {FRONT_B_30_DRAFT_REVIEW,readHistorical027FromReviewedFrontB} from '../helpers/canonical-front-b-source.mjs';
import {readFinance026FromReviewedSources,readFinance027FromReviewedSources} from '../helpers/finance-reviewed-sources.mjs';
import {createHistorical026FromReviewedCanonicalSql,createHistorical027FromReviewedCanonicalSql} from '../helpers/local-canonical-sql.ts';
const repo=fileURLToPath(new URL('../../',import.meta.url));
const candidates=['20261101020254_public_admission_gate.sql','20261101030000_signup_metrics.sql','20261101013633_feedback_requests.sql'];
const code=value=>error=>error?.code===value&&error?.message===value;
async function staged(t,count){const parent=await realpath(resolve(tmpdir())),root=await mkdtemp(join(parent,'sc-finance-reviewed-'));t.after(async()=>{const st=await lstat(root),actual=await realpath(root),inside=relative(parent,actual);if(!st.isDirectory()||st.isSymbolicLink()||!inside||inside==='..'||inside.startsWith(`..${sep}`)||isAbsolute(inside)||!basename(actual).startsWith('sc-finance-reviewed-'))throw Error('FIXTURE_CLEANUP_REFUSED');await rm(actual,{recursive:true,force:true});});await mkdir(join(root,'supabase/migrations'),{recursive:true});for(const row of CURRENT27_CANONICAL_REVIEW)await copyFile(join(repo,'supabase/migrations',row.file),join(root,'supabase/migrations',row.file));if(count===30)for(const [i,file]of candidates.entries())await copyFile(join(repo,'supabase/operations/candidates',file),join(root,'supabase/migrations',FRONT_B_30_DRAFT_REVIEW[27+i].file));assert.equal(buildSqlEditor({root}).migrations,count);return root;}
test('projeções Finance históricas qualificam 27 ou draft30 integral antes de retornar bytes',async t=>{
 const root27=await staged(t,27),root30=await staged(t,30),expected=await readHistorical027FromReviewedFrontB(root27);
 for(const root of [root27,root30])for(const [reader,count]of [[readFinance026FromReviewedSources,26],[readFinance027FromReviewedSources,27]]){const rows=await reader(root);assert.equal(rows.length,count);for(const [i,row]of rows.entries()){assert.deepEqual(Object.keys(row),['file','source']);assert.equal(row.file,expected[i].file);assert.equal(row.source,expected[i].source.toString('utf8'));}}
 await assert.rejects(readCurrent27CanonicalMigrations(root30),code('MIGRATION_MANIFEST_REFUSED'));
});
test('fixtures históricas SQL selecionam 026 ou 027 sem instalar candidatas', {timeout:60000},async t=>{
 const root=await staged(t,30);
 for(const [open,financeExpected]of [[createHistorical026FromReviewedCanonicalSql,false],[createHistorical027FromReviewedCanonicalSql,true]]){const db=await open(root);try{const row=(await db.query("select to_regclass('app_private.finance_goals') is not null as finance, to_regclass('app_private.user_admission') is not null as admission")).rows[0];assert.deepEqual(row,{finance:financeExpected,admission:false});}finally{await db.close();}}
});
test('recusa três candidatas corrompidas e manifesto 30→27 com arquivos extras',async t=>{
 const root=await staged(t,30),loaders=[readFinance026FromReviewedSources,readFinance027FromReviewedSources,createHistorical026FromReviewedCanonicalSql,createHistorical027FromReviewedCanonicalSql];
 for(let i=27;i<30;i++){const file=FRONT_B_30_DRAFT_REVIEW[i].file,source=join(root,'supabase/migrations',file),copy=join(root,'supabase/sql-editor/installation',`${String(i+1).padStart(3,'0')}_${file}`),a=await readFile(source),b=await readFile(copy),bad=Buffer.from(a);bad[0]^=1;try{await writeFile(source,bad);await writeFile(copy,bad);for(const load of loaders)await assert.rejects(load(root),code('MIGRATION_INTEGRITY_FAILED'));}finally{await writeFile(source,a);await writeFile(copy,b);}}
 const p=join(root,'supabase/sql-editor/manifest.json'),before=await readFile(p),manifest=JSON.parse(before);manifest.installation=manifest.installation.slice(0,27);try{await writeFile(p,JSON.stringify(manifest));for(const load of loaders)await assert.rejects(load(root),code('MIGRATION_MANIFEST_REFUSED'));}finally{await writeFile(p,before);}
 for(const load of loaders)await assert.rejects(load('relative'),code('SOURCE_FILE_REFUSED'));
});
