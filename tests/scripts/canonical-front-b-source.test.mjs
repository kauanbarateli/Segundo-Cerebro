import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFile, lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSqlEditor } from "../../scripts/build-sql-editor.mjs";
import { CURRENT27_CANONICAL_REVIEW, readCurrent27CanonicalMigrations, readHistorical026CanonicalMigrations } from "../helpers/canonical-release-source.mjs";
import { FRONT_B_30_DRAFT_REVIEW, readStagedFrontB30, readHistorical026FromStagedFrontB30, readHistorical027FromStagedFrontB30 } from "../helpers/canonical-front-b-source.mjs";

const repository = fileURLToPath(new URL("../../",import.meta.url));
const candidates = ["20261101020254_public_admission_gate.sql","20261101030000_signup_metrics.sql","20261101013633_feedback_requests.sql"];
const code = value => error => error?.code === value && error?.message === value;

async function staged(t) {
  const parent = resolve(tmpdir()), root = await mkdtemp(join(parent,"sc-front-b-30-"));
  t.after(async () => {
    const stat = await lstat(root), actualRoot = await realpath(root), actualParent = await realpath(parent), within = relative(actualParent,actualRoot);
    if (!stat.isDirectory() || stat.isSymbolicLink() || !within || within === ".." || within.startsWith(`..${sep}`) || isAbsolute(within) || !within.startsWith("sc-front-b-30-")) throw new Error("FIXTURE_CLEANUP_REFUSED");
    await rm(actualRoot,{recursive:true,force:true});
  });
  await mkdir(join(root,"supabase/migrations"),{recursive:true});
  for (const row of CURRENT27_CANONICAL_REVIEW) await copyFile(join(repository,"supabase/migrations",row.file),join(root,"supabase/migrations",row.file));
  for (const [i,name] of candidates.entries()) await copyFile(join(repository,"supabase/operations/candidates",name),join(root,"supabase/migrations",FRONT_B_30_DRAFT_REVIEW[27+i].file));
  const result = buildSqlEditor({root});
  assert.equal(result.migrations,30);
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
  for(let i=0;i<27;i++){assert.equal(old27[i].file,actual27[i].file);assert.ok(old27[i].source.equals(actual27[i].source));}
  for(let i=0;i<26;i++){assert.equal(old26[i].file,actual26[i].file);assert.ok(old26[i].source.equals(actual26[i].source));}
  assert.deepEqual(full.slice(27).map(row=>row.file),FRONT_B_30_DRAFT_REVIEW.slice(27).map(row=>row.file));
  assert.ok(Object.isFrozen(full)); assert.ok(Object.isFrozen(FRONT_B_30_DRAFT_REVIEW));

  const manifestPath=join(root,"supabase/sql-editor/manifest.json"), originalManifest=await readFile(manifestPath);
  async function manifestMutation(mutator){
    const manifest=JSON.parse(originalManifest);mutator(manifest);await writeFile(manifestPath,JSON.stringify(manifest));
    try{await assert.rejects(readStagedFrontB30(root),code("MIGRATION_MANIFEST_REFUSED"));}
    finally{await writeFile(manifestPath,originalManifest);}
  }
  for(const mutate of [m=>m.installation.pop(),m=>m.installation[27].order=29,m=>m.installation.reverse(),m=>m.installation[29].version=m.installation[28].version,m=>m.installation[28].source="../escape.sql",m=>m.installation[28].sha256="0".repeat(64),m=>m.installation[28].bytes++,m=>m.installation[28].file=m.installation[27].file,m=>m.installation[27].extra=true]) await manifestMutation(mutate);

  const source=join(root,"supabase/migrations",full[29].file), copy=join(root,"supabase/sql-editor/installation",`030_${full[29].file}`), bytes=await readFile(source), copyBytes=await readFile(copy);
  try{
    const changed=Buffer.from(bytes);changed[0]^=1;
    await writeFile(source,changed);await writeFile(copy,changed);
    await assert.rejects(readStagedFrontB30(root),code("MIGRATION_INTEGRITY_FAILED"));
    await assert.rejects(readHistorical027FromStagedFrontB30(root),code("MIGRATION_INTEGRITY_FAILED"));
    await assert.rejects(readHistorical026FromStagedFrontB30(root),code("MIGRATION_INTEGRITY_FAILED"));
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
