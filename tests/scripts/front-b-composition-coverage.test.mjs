import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCatalogueFixture} from './helpers/catalogue-fixture.mjs';
import {CURRENT27_CANONICAL_REVIEW} from '../helpers/canonical-release-source.mjs';
import {matchesFrontBFixtureObservation} from '../helpers/front-b-historical-observation.mjs';

const source=path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8');
test('role membership e flag operacional exigem verificações além dos três catálogos', {timeout:60000},async()=>{
 const db=await createCatalogueFixture();
 try {
  for(const m of CURRENT27_CANONICAL_REVIEW)await db.exec(await source(`supabase/migrations/${m.file}`));
  await db.exec(await source('supabase/operations/onboarding-conflict-code.sql'));
  for(const file of ['20261101020254_public_admission_gate.sql','20261101030000_signup_metrics.sql','20261101013633_feedback_requests.sql'])await db.exec(await source(`supabase/operations/candidates/${file}`));
  const historic=await source('supabase/tests/release-catalog.sql'),patch=await source('supabase/operations/verify-onboarding-conflict-code.sql'),additive=await source('supabase/operations/verify-front-b-additive.sql'),gate=await source('supabase/operations/verify-front-b-signup-disabled.sql');
  const state=async()=>{
   const c=(await db.exec(historic)).flatMap(x=>x.rows)[0].jsonb_build_object;
   const p=(await db.exec(patch)).flatMap(x=>x.rows)[0].jsonb_build_object;
   const a=(await db.query(additive)).rows[0].result;
   return matchesFrontBFixtureObservation(c,p,a);
  };
  assert.equal(await state(),true);
  await db.exec('create role fixture_external nologin; grant service_role to fixture_external');
  const rights=(await db.query("select pg_has_role('fixture_external','service_role','MEMBER') member, has_function_privilege('fixture_external','public.signup_metrics(uuid,uuid,date,date,text,text)','EXECUTE') can_execute")).rows[0];
  assert.deepEqual(rights,{member:true,can_execute:true});
  assert.equal(await state(),true,'o contrato atual não inspeciona todas as memberships');
  await db.exec('revoke service_role from fixture_external; drop role fixture_external');
  await db.exec('insert into app_private.signup_settings(singleton,enabled) values(true,true)');
  assert.equal(await state(),true,'a configuração é dado, fora dos catálogos');
  assert.equal((await db.query(gate)).rows[0].result.ok,false,'o gate separado identifica o flag ligado');
 }finally{await db.close();}
});
