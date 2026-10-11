// Canonical SQL/PGlite PG18. The Auth transaction order is a GoTrue v2.197.0
// model, not a running GoTrue/PG17 service or evidence of hosted application.
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql.ts";
import { createCatalogueFixture } from "./helpers/catalogue-fixture.mjs";

const migration=new URL("../../supabase/migrations/20261011071500_admin_auth_creation_order.sql",import.meta.url);
const initialMetadata={provider:"email",providers:["email"]};
async function fixture(){
 const db=await createLocalCanonicalSql(),a={id:randomUUID(),session:randomUUID()},execution=randomUUID();
 try{
  await db.query("insert into auth.users(id,aud,role,email) values($1,'authenticated','authenticated',$2)",[a.id,a.id+"@example.invalid"]);
  await db.query("insert into auth.sessions(id,user_id) values($1,$2)",[a.session,a.id]);
  await db.query("select public.bootstrap_master($1::uuid)",[a.id]);
  const reserve=async()=>await db.transaction(async tx=>{
   await tx.exec("set local role service_role");
   return(await tx.query("select public.admin_reserve($1::uuid,$2::uuid,$3::jsonb,$4::uuid) as op",[a.id,a.session,JSON.stringify({command:"admin.user.create",client_id:randomUUID(),commitment:"a".repeat(64)}),execution])).rows[0].op;
  });
  return{db,a,reserve};
 }catch(error){await db.close();throw error;}
}
const residueSql=`select
 (select count(*)::int from auth.users) users,
 (select count(*)::int from auth.sessions) sessions,
 (select count(*)::int from auth.refresh_tokens) refresh_tokens,
 (select count(*)::int from public.profiles) profiles,
 (select count(*)::int from public.user_preferences) preferences,
 (select count(*)::int from public.user_roles) roles,
 (select count(*)::int from public.user_moderation) moderation,
 (select count(*)::int from public.domain_events) events,
 (select count(*)::int from app_private.admin_operations) operations,
 (select count(*)::int from public.admin_audit_events) audit`;
const residue=async db=>(await db.query(residueSql)).rows;
async function insertInitial(tx,op){
 await tx.query("insert into auth.users(id,aud,role,email,raw_app_meta_data,banned_until) values($1,'authenticated','authenticated',$2,$3::jsonb,null)",[op.target_user_id,op.target_user_id+"@example.invalid",JSON.stringify(initialMetadata)]);
}
async function finishAuth(tx,op,{marker=true,ban=true}={}){
 if(marker)await tx.query("update auth.users set raw_app_meta_data=raw_app_meta_data||$2::jsonb where id=$1",[op.target_user_id,JSON.stringify({sc_admin_operation:op.operation_id})]);
 if(ban)await tx.query("update auth.users set banned_until=now()+interval '876000 hours' where id=$1",[op.target_user_id]);
}

test("canonical018 has an initially deferred INSERT constraint, closed privileges and unchanged017 bytes",async()=>{
 const f=await fixture();try{
  const {rows}=await f.db.query(`select t.tgdeferrable,t.tginitdeferred,t.tgtype,t.tgenabled,p.prosecdef,
   pg_get_userbyid(p.proowner) owner,p.proconfig,
   has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,
   has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute,
   has_function_privilege('service_role',p.oid,'EXECUTE') service_execute
   from pg_trigger t join pg_proc p on p.oid=t.tgfoid
   where t.tgrelid='auth.users'::regclass and t.tgname='second_brain_admin_creation_final'`);
  assert.deepEqual(rows,[{tgdeferrable:true,tginitdeferred:true,tgtype:5,tgenabled:"O",prosecdef:true,owner:"postgres",proconfig:['search_path=""'],anon_execute:false,authenticated_execute:false,service_execute:false}]);
  const old017=await readFile(new URL("../../supabase/migrations/20261010044217_finance_monthly_plan.sql",import.meta.url));
  assert.equal(createHash("sha256").update(old017).digest("hex"),"a45052833425a647a193e8d3588257fa6cb392aa12ef39b34f89b57e06d882bf");
 }finally{await f.db.close();}
});
test("GoTrue order fences before metadata/ban, then commits only the correct final row with the ordinary role",async()=>{
 const f=await fixture();try{
  const op=await f.reserve();
  await f.db.transaction(async tx=>{
   await insertInitial(tx,op);
   const before=(await tx.query(`select u.raw_app_meta_data,u.banned_until,r.role,m.status,m.must_change_password
    from auth.users u join public.user_roles r on r.user_id=u.id join public.user_moderation m on m.user_id=u.id where u.id=$1`,[op.target_user_id])).rows[0];
   assert.deepEqual(before,{raw_app_meta_data:initialMetadata,banned_until:null,role:"user",status:"blocked",must_change_password:true});
   await finishAuth(tx,op);
  });
  const final=(await f.db.query(`select u.raw_app_meta_data->>'sc_admin_operation' marker,u.banned_until>now() banned,r.role,m.status,m.must_change_password
   from auth.users u join public.user_roles r on r.user_id=u.id join public.user_moderation m on m.user_id=u.id where u.id=$1`,[op.target_user_id])).rows[0];
  assert.deepEqual(final,{marker:op.operation_id,banned:true,role:"user",status:"blocked",must_change_password:true});
  assert.equal((await f.db.query("select phase from app_private.admin_operations where operation_id=$1",[op.operation_id])).rows[0].phase,"reserved");
 }finally{await f.db.close();}
});
for(const mode of ["missing-marker","wrong-marker","missing-ban","expired-ban","active-moderation","unforced-moderation","master-role","live-session","refresh-token","unclaimed-reservation"])
test("invalid final creation rolls back every Auth/provisioning effect and preserves reservation — "+mode,async()=>{
 const f=await fixture();try{
  const op=await f.reserve(),before=await residue(f.db),operation=(await f.db.query("select * from app_private.admin_operations where operation_id=$1",[op.operation_id])).rows;
  await assert.rejects(f.db.transaction(async tx=>{
   await insertInitial(tx,op);await finishAuth(tx,op,{marker:mode!=="missing-marker",ban:mode!=="missing-ban"});
   if(mode==="wrong-marker")await tx.query("update auth.users set raw_app_meta_data=raw_app_meta_data||$2::jsonb where id=$1",[op.target_user_id,JSON.stringify({sc_admin_operation:randomUUID()})]);
   if(mode==="expired-ban")await tx.query("update auth.users set banned_until=now()-interval '1 second' where id=$1",[op.target_user_id]);
   if(mode==="active-moderation")await tx.query("update public.user_moderation set status='active' where user_id=$1",[op.target_user_id]);
   if(mode==="unforced-moderation")await tx.query("update public.user_moderation set must_change_password=false where user_id=$1",[op.target_user_id]);
   if(mode==="master-role")await tx.query("update public.user_roles set role='master' where user_id=$1",[op.target_user_id]);
   if(mode==="live-session")await tx.query("insert into auth.sessions(id,user_id) values($1,$2)",[randomUUID(),op.target_user_id]);
   if(mode==="refresh-token")await tx.query("insert into auth.refresh_tokens(user_id,token) values($1,'synthetic-only')",[op.target_user_id]);
   if(mode==="unclaimed-reservation")await tx.query("update app_private.admin_operations set active_execution=null where operation_id=$1",[op.operation_id]);
  }),error=>error?.code==="23514");
  assert.deepEqual(await residue(f.db),before);
  assert.deepEqual((await f.db.query("select * from app_private.admin_operations where operation_id=$1",[op.operation_id])).rows,operation);
 }finally{await f.db.close();}
});
test("forcing validation before the final Auth UPDATEs cannot release the reservation or commit an incomplete user",async()=>{
 const f=await fixture();try{
  const op=await f.reserve(),before=await residue(f.db);
  await assert.rejects(f.db.transaction(async tx=>{await insertInitial(tx,op);await tx.exec("set constraints auth.second_brain_admin_creation_final immediate");}),error=>error?.code==="23514");
  assert.deepEqual(await residue(f.db),before);
  await f.db.transaction(async tx=>{await insertInitial(tx,op);await finishAuth(tx,op);await tx.exec("set constraints auth.second_brain_admin_creation_final immediate");});
 }finally{await f.db.close();}
});
test("ordinary creation ignores editable/unreserved operation metadata and never gains a master role",async()=>{
 const f=await fixture();try{
  const id=randomUUID();await f.db.transaction(async tx=>{
   await tx.query("insert into auth.users(id,aud,role,email,raw_app_meta_data) values($1,'authenticated','authenticated',$2,$3::jsonb)",[id,id+"@example.invalid",JSON.stringify(initialMetadata)]);
   await tx.query("update auth.users set raw_app_meta_data=raw_app_meta_data||$2::jsonb where id=$1",[id,JSON.stringify({sc_admin_operation:randomUUID(),role:"master"})]);
  });
  assert.deepEqual((await f.db.query("select r.role,m.status,m.must_change_password from public.user_roles r join public.user_moderation m using(user_id) where user_id=$1",[id])).rows,[{role:"user",status:"active",must_change_password:false}]);
 }finally{await f.db.close();}
});
test("canonical018 precheck refuses reapplication atomically",async()=>{
 const f=await fixture();try{
  const before=await residue(f.db);await assert.rejects(f.db.exec(await readFile(migration,"utf8")),error=>error?.code==="P0001");await f.db.exec("rollback");assert.deepEqual(await residue(f.db),before);
 }finally{await f.db.close();}
});
test("canonical018 precheck refuses an unexpected008 trigger body without overwriting it",async()=>{
 const db=await createCatalogueFixture();try{
  const files=(await readdir(new URL("../../supabase/migrations/",import.meta.url))).filter(name=>/^\d{14}_.+\.sql$/.test(name)&&name<"20261011071500_admin_auth_creation_order.sql").sort();assert.equal(files.length,17);
  for(const file of files)await db.exec(await readFile(new URL("../../supabase/migrations/"+file,import.meta.url),"utf8"));
  const definition=(await db.query("select pg_get_functiondef('app_private.on_auth_user_created()'::regprocedure) as definition")).rows[0].definition;
  const weakened=definition.replace("must_change_password=true","must_change_password=false");assert.notEqual(weakened,definition);await db.exec(weakened);
  const before=(await db.query("select prosrc from pg_proc where oid='app_private.on_auth_user_created()'::regprocedure")).rows;
  await assert.rejects(db.exec(await readFile(migration,"utf8")),error=>error?.code==="P0001");await db.exec("rollback");
  assert.deepEqual((await db.query("select prosrc from pg_proc where oid='app_private.on_auth_user_created()'::regprocedure")).rows,before);
  assert.equal((await db.query("select to_regprocedure('app_private.check_admin_auth_creation_final()') as final_guard")).rows[0].final_guard,null);
  assert.deepEqual(await residue(db),[{users:0,sessions:0,refresh_tokens:0,profiles:0,preferences:0,roles:0,moderation:0,events:0,operations:0,audit:0}]);
 }finally{await db.close();}
});
