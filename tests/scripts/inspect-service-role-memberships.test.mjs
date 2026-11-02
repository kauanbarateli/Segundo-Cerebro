import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCatalogueFixture} from './helpers/catalogue-fixture.mjs';

const sql=await readFile(new URL('../../supabase/operations/inspect-service-role-memberships.sql',import.meta.url),'utf8');
const snapshot=async db=>(await db.query(`select
 (select jsonb_agg(jsonb_build_array(oid,rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolbypassrls) order by oid) from pg_roles) roles,
 (select jsonb_agg(jsonb_build_array(roleid,member,grantor,admin_option,inherit_option,set_option) order by roleid,member,grantor) from pg_auth_members) memberships`)).rows[0];
const readOnly=async db=>{
 await db.exec('begin transaction read only');
 try{return (await db.query(sql)).rows[0].result;}finally{await db.exec('rollback');}
};

test('sumário de memberships classifica caminhos, opções e não altera roles', {timeout:60000},async()=>{
 const db=await createCatalogueFixture();
 try{
  const empty=await readOnly(db);assert.equal(empty.status,'NO_EXPLICIT_MEMBERS');assert.equal(empty.counts.total,0);
  await db.exec(`create role fixture_direct login bypassrls createrole createdb;
   create role fixture_transitive nologin;
   create role fixture_restricted nologin noinherit;
   create role fixture_admin nologin;
   grant service_role to fixture_direct;
   grant fixture_direct to fixture_transitive;
   grant service_role to fixture_restricted with inherit false, set false;
   grant service_role to fixture_admin with admin true`);
  const before=await snapshot(db),result=await readOnly(db);
  assert.deepEqual(await snapshot(db),before);
  assert.equal(result.check,'service_role_memberships_aggregate');assert.equal(result.status,'REVIEW_REQUIRED');
  assert.deepEqual(result.counts,{total:4,direct:3,transitive_only:1,login:1,superuser:0,bypass_rls:1,create_role:1,create_db:1,role_inherit:3,usable_now:3,can_set_role:3,direct_admin_option:1,direct_inherit_option:2,direct_set_option:2});
  assert.doesNotMatch(JSON.stringify(result),/fixture_|password|secret|credential|email/i);
  await assert.rejects(db.exec('grant fixture_transitive to fixture_direct'),error=>error.code==='0LP01');
  assert.deepEqual(await readOnly(db),result,'ciclo recusado não muda a observação');
  await db.exec('grant service_role to fixture_transitive');
  const redundant=await readOnly(db);assert.equal(redundant.counts.total,4);assert.equal(redundant.counts.direct,4);assert.equal(redundant.counts.transitive_only,0);
 }finally{await db.close();}
});

test('ausência do role alvo não é confundida com lista vazia', {timeout:60000},async()=>{
 const db=await createCatalogueFixture();
 try{
  await db.exec('alter role service_role rename to fixture_service_renamed');
  const result=await readOnly(db);assert.equal(result.status,'TARGET_ABSENT');assert.equal(result.counts.total,0);
 }finally{await db.close();}
});
