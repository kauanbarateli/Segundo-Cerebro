// Opt-in, disposable PGlite reproduction only; no native Auth or release claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const args=process.argv.slice(2);
if(!args.length||args.length===1&&args[0]==='--help'){
 process.stdout.write(JSON.stringify({code:'NO_DATABASE_STARTED',purpose:'DIAGNOSTIC_NOT_VALIDATION'})+'\n');
}else if(args.length!==1||args[0]!=='--execute'||process.env.SC_FRONT_B_LEGACY_DIAGNOSTIC!=='1'){
 process.stdout.write(JSON.stringify({code:'OPT_IN_REQUIRED',purpose:'DIAGNOSTIC_NOT_VALIDATION'})+'\n');process.exitCode=1;
}else if((await import('node:os')).freemem()<1024**3){
 process.stdout.write(JSON.stringify({code:'INSUFFICIENT_MEMORY',purpose:'DIAGNOSTIC_NOT_VALIDATION'})+'\n');process.exitCode=1;
}else{
 const {createCatalogueFixture}=await import('../../../tests/scripts/helpers/catalogue-fixture.mjs');
 const {readCurrent27CanonicalMigrations}=await import('../../../tests/helpers/canonical-release-source.mjs');
 const root=new URL('../../../',import.meta.url),candidate=await readFile(new URL('supabase/operations/candidates/20261101020254_public_admission_gate.sql',root));
 assert.equal(candidate.length,31936);assert.equal(createHash('sha256').update(candidate).digest('hex'),'e125759742d7fa1513f7d42ad04ee13c1a6c8894b98478261d1217381f93f519');
 const user='51000000-0000-4000-8000-000000000001',session='51000000-0000-4000-8000-000000000002',subject='a'.repeat(64);
 const setup=async forced=>{
  const db=await createCatalogueFixture();try{
   for(const migration of await readCurrent27CanonicalMigrations(fileURLToPath(root)))await db.exec(migration.source.toString('utf8'));
   await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,null)',[user,'legacy@example.invalid']);
   await db.query("update public.user_moderation set status='active',must_change_password=$2 where user_id=$1",[user,forced]);
   await db.query('insert into auth.sessions(id,user_id,not_after) values($1,$2,now()+interval \'1 hour\')',[session,user]);
   return db;
  }catch(error){await db.close();throw error;}
 };
 const active=async db=>(await db.query('select app_private.session_active($1,$2) active',[user,session])).rows[0].active;
 const forced=async db=>(await db.query('select must_change_password forced from public.user_moderation where user_id=$1',[user])).rows[0].forced;
 const admission=async db=>(await db.query('select origin,state from app_private.user_admission where user_id=$1',[user])).rows[0];
 const password=async db=>db.query('select app_private.complete_password_change($1,$2,$3) result',[user,session,'legacy-password-control']);
 const pending=async db=>(await db.query('select app_private.signup_pending_identity($1,$2) pending',[user,session])).rows[0].pending;
 process.stdout.write(JSON.stringify({code:'DIAGNOSTIC_ONLY',purpose:'RISK_DEMONSTRATION_NOT_MIGRATION_VALIDATION',nativeAuthVerified:false})+'\n');

 test('conta legada com troca forçada pode ficar presa após candidata 028',{timeout:60000},async()=>{
  const db=await setup(true);
  try{
   assert.equal(await active(db),true);assert.equal(await forced(db),true);
   await db.exec('begin;');const before=await password(db);assert.equal(before.rows[0].result.completed,true);await db.exec('rollback;');assert.equal(await forced(db),true);
   // The preflight excludes this user because must_change_password is true.
   await db.exec(candidate.toString('utf8'));assert.deepEqual(await admission(db),{origin:'unclassified',state:'pending'});assert.equal(await active(db),false);
   // Even after a hypothetical verified email, both paths retain the cycle.
   await db.query('update auth.users set email_confirmed_at=now() where id=$1',[user]);
   await db.exec('insert into app_private.signup_settings(singleton,enabled) values(true,true)');
   assert.equal(await pending(db),false);
   await assert.rejects(password(db),error=>error?.code==='42501');
   await assert.rejects(db.query('select app_private.signup_recover_verified_intent($1,$2,$3,$4,$5)',[user,session,subject,'terms-v1','privacy-v1']),error=>error?.code==='42501');
   assert.equal(await forced(db),true);assert.deepEqual(await admission(db),{origin:'unclassified',state:'pending'});
  }finally{await db.close();}
 });
 test('controle: mesma conta sem troca forçada e com sessão ativa é recusada no preflight',{timeout:60000},async()=>{
  const db=await setup(false);
  try{
   assert.equal(await active(db),true);assert.equal(await forced(db),false);
   await assert.rejects(db.exec(candidate.toString('utf8')),error=>error?.code==='23514'&&/Existing active unconfirmed identity/.test(error.message));
   await db.exec('rollback;');assert.equal((await db.query("select to_regclass('app_private.user_admission') is null absent")).rows[0].absent,true);
   assert.equal(await active(db),true);
  }finally{await db.close();}
 });
}
