import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCatalogueFixture} from './helpers/catalogue-fixture.mjs';

const labeled=await readFile(new URL('../../supabase/operations/inspect-service-role-memberships-labeled-v1.sql',import.meta.url),'utf8');
const aggregate=await readFile(new URL('../../supabase/operations/inspect-service-role-memberships.sql',import.meta.url),'utf8');
const inventory=async db=>(await db.query(`select
 (select jsonb_agg(jsonb_build_array(oid,rolname,rolinherit,rolcanlogin,rolsuper,rolbypassrls) order by oid) from pg_roles) roles,
 (select jsonb_agg(jsonb_build_array(roleid,member,grantor,admin_option,inherit_option,set_option) order by roleid,member,grantor) from pg_auth_members) memberships`)).rows[0];
const inspect=async db=>{
 await db.exec('begin transaction read only');
 try{return (await db.query(labeled)).rows[0].result;}finally{await db.exec('rollback');}
};

test('rótulos conhecidos, caminhos transitivos e demais roles anonimizadas em PGlite', {timeout:60000},async()=>{
 const db=await createCatalogueFixture();
 try{
  const empty=await inspect(db);assert.equal(empty.status,'NO_EXPLICIT_MEMBERS');assert.deepEqual(empty.roles,[]);
  await db.exec(`create role authenticator login noinherit;
   create role supabase_realtime_admin nologin noinherit;
   create role supabase_storage_admin login noinherit;
   create role supabase_read_only_user nologin noinherit;
   create role "person@example.invalid" nologin noinherit;
   create role fixture_private nologin noinherit;
   grant service_role to authenticator with inherit false, set true;
   grant service_role to supabase_realtime_admin with inherit false, set true;
   grant service_role to supabase_read_only_user with inherit false, set false;
   grant supabase_realtime_admin to supabase_storage_admin with inherit false, set true;
   grant service_role to postgres with admin true;
   grant service_role to "person@example.invalid" with inherit false, set false;
   grant "person@example.invalid" to fixture_private with inherit false, set false`);
  const before=await inventory(db),result=await inspect(db);assert.deepEqual(await inventory(db),before);
  assert.equal(result.check,'service_role_memberships_labeled_v1');assert.equal(result.status,'REVIEW_REQUIRED');
  assert.deepEqual(result.roles.map(row=>row.label),['[outro]','authenticator','postgres','supabase_read_only_user','supabase_realtime_admin','supabase_storage_admin']);
  const byLabel=Object.fromEntries(result.roles.map(row=>[row.label,row]));
  assert.equal(byLabel['[outro]'].members,2);assert.equal(byLabel['[outro]'].direct,1);assert.equal(byLabel['[outro]'].transitive_only,1);
  assert.equal(byLabel['[outro]'].usable_now,0);assert.equal(byLabel['[outro]'].can_set_role,0);
  assert.equal(byLabel.authenticator.members,1);assert.equal(byLabel.authenticator.direct,1);assert.equal(byLabel.authenticator.usable_now,0);assert.equal(byLabel.authenticator.can_set_role,1);
  assert.equal(byLabel.supabase_read_only_user.members,1);assert.equal(byLabel.supabase_read_only_user.can_set_role,0);
  assert.equal(byLabel.supabase_storage_admin.transitive_only,1);assert.equal(byLabel.supabase_storage_admin.can_set_role,1);
  assert.equal(byLabel.postgres.direct,1);assert.equal(byLabel.postgres.direct_admin_option,1);
  assert.doesNotMatch(JSON.stringify(result),/person@example|fixture_private|password|credential|secret/i);
  const counts=(await db.query(aggregate)).rows[0].result.counts;
  for(const [a,b] of [['total','members'],...Object.keys(counts).filter(key=>key!=='total').map(key=>[key,key])])assert.equal(result.roles.reduce((sum,row)=>sum+row[b],0),counts[a],a);
  await db.exec('grant service_role to supabase_storage_admin');
  const duplicate=await inspect(db),storage=duplicate.roles.find(row=>row.label==='supabase_storage_admin');
  assert.equal(storage.members,1);assert.equal(storage.direct,1);assert.equal(storage.transitive_only,0);
 }finally{await db.close();}
});

test('role alvo ausente não se confunde com inventário vazio', {timeout:60000},async()=>{
 const db=await createCatalogueFixture();
 try{await db.exec('alter role service_role rename to fixture_service_renamed');const result=await inspect(db);assert.equal(result.status,'TARGET_ABSENT');assert.deepEqual(result.roles,[]);}finally{await db.close();}
});
