import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFile, lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { registerHooks } from "node:module";
import { buildSqlEditor } from "../../scripts/build-sql-editor.mjs";
import { CURRENT27_CANONICAL_REVIEW, readCurrent27CanonicalMigrations, readHistorical026CanonicalMigrations } from "../helpers/canonical-release-source.mjs";
import { FRONT_B_30_DRAFT_REVIEW, readStagedFrontB30, readHistorical026FromStagedFrontB30, readHistorical027FromStagedFrontB30, readReviewedFrontBChain, readHistorical026FromReviewedFrontB, readHistorical027FromReviewedFrontB } from "../helpers/canonical-front-b-source.mjs";
import { createHistorical026CanonicalSql } from "../helpers/local-canonical-sql.ts";

// Mirror the narrowly scoped Node bridge used by onboarding-release-catalog.
const onboardingHelper=new URL("../helpers/onboarding-candidate-sql.ts",import.meta.url),localHelper=new URL("../helpers/local-canonical-sql.ts",import.meta.url);
const bridge=registerHooks({resolve(specifier,context,next){return specifier==="./local-canonical-sql"&&context.parentURL===onboardingHelper.href?next(localHelper.href,context):next(specifier,context);}});
let createOnboardingCandidateSql;
try{({createOnboardingCandidateSql}=await import(onboardingHelper.href));}finally{bridge.deregister();}

const repository = fileURLToPath(new URL("../../",import.meta.url));
const candidates = ["20261101020254_public_admission_gate.sql","20261101030000_signup_metrics.sql","20261101013633_feedback_requests.sql"];
const code = value => error => error?.code === value && error?.message === value;

async function staged(t,count=30) {
  const parent = resolve(tmpdir()), root = await mkdtemp(join(parent,"sc-front-b-30-"));
  t.after(async () => {
    const stat = await lstat(root), actualRoot = await realpath(root), actualParent = await realpath(parent), within = relative(actualParent,actualRoot);
    if (!stat.isDirectory() || stat.isSymbolicLink() || !within || within === ".." || within.startsWith(`..${sep}`) || isAbsolute(within) || !within.startsWith("sc-front-b-30-")) throw new Error("FIXTURE_CLEANUP_REFUSED");
    await rm(actualRoot,{recursive:true,force:true});
  });
  await mkdir(join(root,"supabase/migrations"),{recursive:true});
  for (const row of CURRENT27_CANONICAL_REVIEW) await copyFile(join(repository,"supabase/migrations",row.file),join(root,"supabase/migrations",row.file));
  if(count===30) for (const [i,name] of candidates.entries()) await copyFile(join(repository,"supabase/operations/candidates",name),join(root,"supabase/migrations",FRONT_B_30_DRAFT_REVIEW[27+i].file));
  const result = buildSqlEditor({root});
  assert.equal(result.migrations,count);
  return root;
}

test("cadeia candidata de 30 fontes é fechada e projeções históricas exigem a cadeia completa",async t=>{
  const root = await staged(t);
  const actual27 = await readCurrent27CanonicalMigrations(), actual26 = await readHistorical026CanonicalMigrations();
  assert.equal(actual27.length,27); assert.equal(actual26.length,26);
  await assert.rejects(readStagedFrontB30(repository),code("MIGRATION_MANIFEST_REFUSED"));
  await assert.rejects(readCurrent27CanonicalMigrations(root),code("MIGRATION_MANIFEST_REFUSED"));
  await assert.rejects(readHistorical026CanonicalMigrations(root),code("MIGRATION_MANIFEST_REFUSED"));
  const full = await readStagedFrontB30(root), old27 = await readHistorical027FromStagedFrontB30(root), old26 = await readHistorical026FromStagedFrontB30(root);
  assert.equal(full.length,30); assert.equal(old27.length,27); assert.equal(old26.length,26);
  const reviewed=await readReviewedFrontBChain(root);assert.equal(reviewed.state,"draft_30");assert.equal(reviewed.sources.length,30);assert.ok(Object.isFrozen(reviewed));
  assert.equal((await readHistorical027FromReviewedFrontB(root)).length,27);assert.equal((await readHistorical026FromReviewedFrontB(root)).length,26);
  for(let i=0;i<27;i++){assert.equal(old27[i].file,actual27[i].file);assert.ok(old27[i].source.equals(actual27[i].source));}
  for(let i=0;i<26;i++){assert.equal(old26[i].file,actual26[i].file);assert.ok(old26[i].source.equals(actual26[i].source));}
  assert.deepEqual(full.slice(27).map(row=>row.file),FRONT_B_30_DRAFT_REVIEW.slice(27).map(row=>row.file));
  assert.ok(Object.isFrozen(full)); assert.ok(Object.isFrozen(FRONT_B_30_DRAFT_REVIEW));

  const manifestPath=join(root,"supabase/sql-editor/manifest.json"), originalManifest=await readFile(manifestPath);
  async function manifestMutation(mutator){
    const manifest=JSON.parse(originalManifest);mutator(manifest);await writeFile(manifestPath,JSON.stringify(manifest));
    try{await assert.rejects(readStagedFrontB30(root),code("MIGRATION_MANIFEST_REFUSED"));await assert.rejects(readReviewedFrontBChain(root),code("MIGRATION_MANIFEST_REFUSED"));}
    finally{await writeFile(manifestPath,originalManifest);}
  }
  for(const mutate of [m=>m.installation.pop(),m=>m.installation.splice(28),m=>m.installation.splice(27),m=>m.installation[27].order=29,m=>m.installation.reverse(),m=>m.installation[29].version=m.installation[28].version,m=>m.installation[28].source="../escape.sql",m=>m.installation[28].sha256="0".repeat(64),m=>m.installation[28].bytes++,m=>m.installation[28].file=m.installation[27].file,m=>m.installation[27].extra=true]) await manifestMutation(mutate);

  const source=join(root,"supabase/migrations",full[29].file), copy=join(root,"supabase/sql-editor/installation",`030_${full[29].file}`), bytes=await readFile(source), copyBytes=await readFile(copy);
  try{
    const changed=Buffer.from(bytes);changed[0]^=1;
    await writeFile(source,changed);await writeFile(copy,changed);
    await assert.rejects(readStagedFrontB30(root),code("MIGRATION_INTEGRITY_FAILED"));
    await assert.rejects(readHistorical027FromStagedFrontB30(root),code("MIGRATION_INTEGRITY_FAILED"));
    await assert.rejects(readHistorical026FromStagedFrontB30(root),code("MIGRATION_INTEGRITY_FAILED"));
    await assert.rejects(readReviewedFrontBChain(root),code("MIGRATION_INTEGRITY_FAILED"));
    await assert.rejects(readHistorical027FromReviewedFrontB(root),code("MIGRATION_INTEGRITY_FAILED"));
    await assert.rejects(readHistorical026FromReviewedFrontB(root),code("MIGRATION_INTEGRITY_FAILED"));
  }finally{await writeFile(source,bytes);await writeFile(copy,copyBytes);}
  try{await writeFile(copy,Buffer.concat([copyBytes,Buffer.from("-- drift\n")]));await assert.rejects(readStagedFrontB30(root),code("MIGRATION_INTEGRITY_FAILED"));}
  finally{await writeFile(copy,copyBytes);}
  const extra=join(root,"supabase/migrations/20990101000000_extra.sql");
  try{await writeFile(extra,"-- extra\n");await assert.rejects(readStagedFrontB30(root),code("MIGRATION_MANIFEST_REFUSED"));}
  finally{await rm(extra,{force:true});}
  const extraCopy=join(root,"supabase/sql-editor/installation/031_20990101000000_extra.sql");
  try{await writeFile(extraCopy,"-- extra\n");await assert.rejects(readStagedFrontB30(root),code("MIGRATION_MANIFEST_REFUSED"));}
  finally{await rm(extraCopy,{force:true});}
  const backup=`${copy}.backup`;
  await rename(copy,backup);
  try{await assert.rejects(readStagedFrontB30(root),code("MIGRATION_MANIFEST_REFUSED"));}
  finally{await rename(backup,copy);}
  const sourceBackup=`${source}.backup`;
  await rename(source,sourceBackup);
  try{await assert.rejects(readStagedFrontB30(root),code("MIGRATION_MANIFEST_REFUSED"));}
  finally{await rename(sourceBackup,source);}
  await t.test("recusa fonte simbólica quando o sistema permite criar links",async sub=>{
    await rename(source,backup);
    let created=false;
    try{
      try{await symlink(backup,source,"file");created=true;}
      catch(error){if(error?.code==="EPERM"||error?.code==="EACCES"||error?.code==="ENOTSUP"){sub.skip("sistema não permite criar link simbólico");return;}throw error;}
      await assert.rejects(readStagedFrontB30(root),code("SOURCE_FILE_REFUSED"));
    }finally{if(created)await rm(source,{force:true});await rename(backup,source);}
  });
  assert.equal((await readStagedFrontB30(root)).length,30);
  await assert.rejects(readStagedFrontB30("relative"),code("SOURCE_FILE_REFUSED"));
  await assert.rejects(readStagedFrontB30(),code("SOURCE_FILE_REFUSED"));
});

test("despacho aceita somente a cadeia íntegra de 27 ou 30, nunca um fallback",async t=>{
  const root=await staged(t,27), actual=await readCurrent27CanonicalMigrations(root), reviewed=await readReviewedFrontBChain(root);
  assert.equal(reviewed.state,"reviewed_27");assert.equal(reviewed.sources.length,27);
  const history27=await readHistorical027FromReviewedFrontB(root),history26=await readHistorical026FromReviewedFrontB(root);
  assert.equal(history27.length,27);assert.equal(history26.length,26);
  for(let i=0;i<27;i++)assert.ok(history27[i].source.equals(actual[i].source));
  for(let i=0;i<26;i++)assert.ok(history26[i].source.equals(actual[i].source));
  const source=join(root,"supabase/migrations",actual[26].file),copy=join(root,"supabase/sql-editor/installation",`027_${actual[26].file}`),bytes=await readFile(source),copyBytes=await readFile(copy),changed=Buffer.from(bytes);
  changed[0]^=1;
  try{await writeFile(source,changed);await writeFile(copy,changed);await assert.rejects(readReviewedFrontBChain(root),code("MIGRATION_INTEGRITY_FAILED"));await assert.rejects(readHistorical026FromReviewedFrontB(root),code("MIGRATION_INTEGRITY_FAILED"));}
  finally{await writeFile(source,bytes);await writeFile(copy,copyBytes);}
  const manifestPath=join(root,"supabase/sql-editor/manifest.json"),original=await readFile(manifestPath),manifest=JSON.parse(original);
  const expanded=JSON.parse(original);expanded.installation[0].extra=true;
  try{await writeFile(manifestPath,JSON.stringify(expanded));await assert.rejects(readReviewedFrontBChain(root),code("MIGRATION_MANIFEST_REFUSED"));}
  finally{await writeFile(manifestPath,original);}
  manifest.installation.push(...FRONT_B_30_DRAFT_REVIEW.slice(27).map((row,i)=>({order:28+i,version:row.file.slice(0,14),source:`supabase/migrations/${row.file}`,file:`installation/${String(28+i).padStart(3,"0")}_${row.file}`,bytes:row.bytes,sha256:row.sha256})));
  try{await writeFile(manifestPath,JSON.stringify(manifest));await assert.rejects(readReviewedFrontBChain(root),code("MIGRATION_MANIFEST_REFUSED"));}
  finally{await writeFile(manifestPath,original);}
  assert.equal((await readReviewedFrontBChain(root)).state,"reviewed_27");
  await assert.rejects(readReviewedFrontBChain("relative"),code("SOURCE_FILE_REFUSED"));
});

test("fixture de onboarding qualifica 30 fontes e instala somente o prefixo 026",{timeout:60000},async t=>{
  const root=await staged(t),db=await createOnboardingCandidateSql(root);
  try{
    const {rows}=await db.query("select to_regclass('app_private.onboarding_entries') is not null as onboarding, to_regclass('app_private.finance_series') is null as sem_financeiro_027, to_regclass('app_private.user_admission') is null as sem_admissao_028, to_regprocedure('public.signup_metrics(uuid,uuid,date,date,text,text)') is null as sem_metricas_029, to_regclass('app_private.feedback_requests') is null as sem_feedback_030");
    assert.deepEqual(rows,[{onboarding:true,sem_financeiro_027:true,sem_admissao_028:true,sem_metricas_029:true,sem_feedback_030:true}]);
  }finally{await db.close();}
  const name=FRONT_B_30_DRAFT_REVIEW[29].file, source=join(root,"supabase/migrations",name), copy=join(root,"supabase/sql-editor/installation",`030_${name}`), bytes=await readFile(source),copyBytes=await readFile(copy),changed=Buffer.from(bytes);
  changed[0]^=1;
  try{await writeFile(source,changed);await writeFile(copy,changed);await assert.rejects(createHistorical026CanonicalSql(root),code("MIGRATION_INTEGRITY_FAILED"));await assert.rejects(createOnboardingCandidateSql(root),code("MIGRATION_INTEGRITY_FAILED"));}
  finally{await writeFile(source,bytes);await writeFile(copy,copyBytes);}
});
