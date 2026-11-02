import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createCatalogueFixture} from './helpers/catalogue-fixture.mjs';
import {CURRENT27_CANONICAL_REVIEW} from '../helpers/canonical-release-source.mjs';
import {FRONT_B_FIXTURE_DEVIATIONS,matchesFrontBFixtureObservation} from '../helpers/front-b-historical-observation.mjs';

const fromRoot=path=>readFile(new URL(`../../${path}`,import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const candidates=[
 ['20261101020254_public_admission_gate.sql','e125759742d7fa1513f7d42ad04ee13c1a6c8894b98478261d1217381f93f519'],
 ['20261101030000_signup_metrics.sql','55b72a3a566af68e4795b367707cda5745c70321e0186b1536fe6f63bdc3dd5f'],
 ['20261101013633_feedback_requests.sql','736a9113322317e63e676a4554f6f57231becc9d67065c7f95c97572ad0cc9d6'],
];

test('PGlite 18.3: observação histórica fixa exige também PT409 e catálogo aditivo', {timeout:60000},async()=>{
 const db=await createCatalogueFixture();
 try{
  assert.equal((await db.query('show server_version')).rows[0].server_version,'18.3');
  for(const m of CURRENT27_CANONICAL_REVIEW){const b=await fromRoot(`supabase/migrations/${m.file}`);assert.equal(sha(b),m.sha256);await db.exec(b.toString('utf8'));}
  const patch=await fromRoot('supabase/operations/onboarding-conflict-code.sql');assert.equal(sha(patch),'4ba6a09351e60504cbc6e5fe6500e5e70045fc6d07012f2e375704ca6bc77bba');await db.exec(patch.toString('utf8'));
  for(const[name,pin]of candidates){const b=await fromRoot(`supabase/operations/candidates/${name}`);assert.equal(sha(b),pin);await db.exec(b.toString('utf8'));}
  const historical=await fromRoot('supabase/tests/release-catalog.sql'),patchSql=await fromRoot('supabase/operations/verify-onboarding-conflict-code.sql'),additiveSql=await fromRoot('supabase/operations/verify-front-b-additive.sql');
  const historic=async()=>(await db.exec(historical.toString('utf8'))).flatMap(part=>part.rows)[0].jsonb_build_object;
  const patchCheck=async()=>(await db.exec(patchSql.toString('utf8'))).flatMap(part=>part.rows)[0].jsonb_build_object;
  const additive=async()=>(await db.query(additiveSql.toString('utf8'))).rows[0].result;
  const initial=await historic(),p=await patchCheck(),a=await additive();
  assert.equal(FRONT_B_FIXTURE_DEVIATIONS.length,26);
  assert.equal(FRONT_B_FIXTURE_DEVIATIONS.filter(v=>v.check==='service_function_allowlist').length,23);
  assert.equal(initial.ok,false);assert.equal(initial.checks,2650);assert.equal(initial.deviations.length,26);
  assert.equal(matchesFrontBFixtureObservation(initial,p,a),true);
  assert.equal(matchesFrontBFixtureObservation({...initial,checks:2649},p,a),false);
  assert.equal(matchesFrontBFixtureObservation({...initial,deviations:initial.deviations.slice(1)},p,a),false);

  // The old catalogue detects a new historical security regression.
  await db.exec('grant select on public.profiles to anon');
  const exposed=await historic();assert.equal(exposed.deviations.length,27);
  assert.ok(exposed.deviations.some(x=>x.check==='anonymous_table_closed'&&x.object==='public.profiles'));
  assert.equal(matchesFrontBFixtureObservation(exposed,await patchCheck(),await additive()),false);
  await db.exec('revoke select on public.profiles from anon');
  assert.equal(matchesFrontBFixtureObservation(await historic(),await patchCheck(),await additive()),true);

  // The patch's already-failing old check can mask a new grant; its separate
  // exact ACL classifier must reject it even if the old deviation set matches.
  await db.exec('grant execute on function public.onboarding_call(uuid,uuid,text,jsonb) to authenticated');
  assert.equal((await patchCheck()).ok,false);
  assert.equal(matchesFrontBFixtureObservation(await historic(),await patchCheck(),await additive()),false);
  await db.exec('revoke execute on function public.onboarding_call(uuid,uuid,text,jsonb) from authenticated');
  assert.equal(matchesFrontBFixtureObservation(await historic(),await patchCheck(),await additive()),true);

  // Likewise, the historical onboarding relation check was already red. A
  // weaker new check is invisible to that baseline but caught independently.
  await db.exec('alter table app_private.onboarding_entries drop constraint onboarding_entry_source_check; alter table app_private.onboarding_entries add constraint onboarding_entry_source_check check(true)');
  const masked=await historic();assert.deepEqual(masked,initial);
  const bad=await additive();assert.equal(bad.ok,false);
  assert.ok(bad.failures.some(v=>v.object==='app_private.onboarding_entries.onboarding_entry_source_check'));
  assert.equal(matchesFrontBFixtureObservation(masked,await patchCheck(),bad),false);
 }finally{await db.close();}
});
