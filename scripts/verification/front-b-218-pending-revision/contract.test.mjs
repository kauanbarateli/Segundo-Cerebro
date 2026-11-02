import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const { PGlite } = createRequire(import.meta.url)('@electric-sql/pglite');
const source=await readFile(new URL('./guarded.sql.txt',import.meta.url),'utf8');
const guard="DO $guard$ BEGIN RAISE EXCEPTION 'GUARDED: pending consent revision is not qualified'; END $guard$;";
const user='10000000-0000-4000-8000-000000000001',session='20000000-0000-4000-8000-000000000001',intent='30000000-0000-4000-8000-000000000001',request='40000000-0000-4000-8000-000000000001',generation='50000000-0000-4000-8000-000000000001',rev='60000000-0000-4000-8000-000000000001',newRev='60000000-0000-4000-8000-000000000002';
const setup=`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA app_private;
CREATE TABLE app_private.signup_intents(id uuid PRIMARY KEY,user_id uuid,origin jsonb,origin_revision uuid);
CREATE TABLE app_private.signup_completion_fences_draft(user_id uuid PRIMARY KEY,intent_id uuid,owner_session_id uuid,request_id uuid,generation uuid,phase text,origin_accepted boolean,origin_withdrawn boolean NOT NULL DEFAULT false);
INSERT INTO app_private.signup_intents VALUES ('${intent}','${user}','{"utm_source":"synthetic"}','${rev}');
CREATE FUNCTION app_private.origin_withdrawal_current_v2(u uuid,s uuid) RETURNS jsonb LANGUAGE plpgsql AS $$ DECLARE i app_private.signup_intents; BEGIN
 IF u<>'${user}'::uuid OR s<>'${session}'::uuid THEN RAISE EXCEPTION 'Unavailable.'; END IF;
 SELECT * INTO i FROM app_private.signup_intents WHERE user_id=u FOR UPDATE;
 RETURN CASE WHEN i.origin IS NULL THEN jsonb_build_object('status','absent','revision',NULL) ELSE jsonb_build_object('status','active','revision',i.origin_revision) END;
END $$;
CREATE FUNCTION app_private.draft_reserve_completion(u uuid,s uuid,i uuid,h text,r uuid,t text,p text,accepted boolean,v text) RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM app_private.signup_completion_fences_draft WHERE user_id=u AND phase='password_acknowledged') THEN RETURN (SELECT jsonb_build_object('status','acknowledged','requestId',request_id,'generation',generation) FROM app_private.signup_completion_fences_draft WHERE user_id=u); END IF;
 IF EXISTS(SELECT 1 FROM app_private.signup_completion_fences_draft WHERE user_id=u) THEN RETURN jsonb_build_object('status','pending'); END IF;
 IF NOT accepted THEN UPDATE app_private.signup_intents SET origin=NULL,origin_revision=NULL WHERE id=i; END IF;
 INSERT INTO app_private.signup_completion_fences_draft VALUES(u,i,s,r,'${generation}','reserved',accepted,false);
 RETURN jsonb_build_object('status','acquired','requestId',r,'generation','${generation}'); END $$;
CREATE FUNCTION app_private.draft_withdraw_current(u uuid,s uuid) RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN
 UPDATE app_private.signup_intents SET origin=NULL,origin_revision=NULL WHERE user_id=u; UPDATE app_private.signup_completion_fences_draft SET origin_withdrawn=true WHERE user_id=u;
 RETURN jsonb_build_object('status','withdrawn'); END $$;
CREATE FUNCTION app_private.draft_finish_fenced(u uuid,s uuid,i uuid,h text,r uuid,g uuid,t text,p text,v text) RETURNS boolean LANGUAGE plpgsql AS $$ BEGIN
 UPDATE app_private.signup_completion_fences_draft SET phase='complete' WHERE user_id=u AND owner_session_id=s AND intent_id=i AND request_id=r AND generation=g; RETURN FOUND; END $$;
CREATE FUNCTION public.signup_fence_reserve(uuid,uuid,uuid,text,uuid,text,text,boolean,text) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
CREATE FUNCTION public.signup_fence_finish(uuid,uuid,uuid,text,uuid,uuid,text,text,text) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;`;
const reserve=(expected,accepted=true)=>[user,session,intent,'a'.repeat(64),request,'terms','privacy',accepted,accepted?'origin-v1':null,expected];
const reserveSql='SELECT public.signup_fence_reserve_origin_v2($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) AS result';
const finishSql='SELECT public.signup_fence_finish_origin_v2($1,$2,$3,$4,$5,$6,$7,$8,$9) AS result';
const finish=[user,session,intent,'a'.repeat(64),request,generation,'terms','privacy','origin-v1'];
async function database(){const db=new PGlite();await db.exec(setup);assert.equal(source.split(guard).length,2);await db.exec(source.replace(guard,''));return db;}
test('a candidata guardada aborta sem alterações',async()=>{const db=new PGlite();try{await assert.rejects(db.exec(source),/GUARDED: pending consent revision is not qualified/);}finally{await db.close();}});
test('reserva recusa revisão ou ausência ultrapassadas sem apagar o novo consentimento',async()=>{const db=await database();try{
 const acl=(await db.query("SELECT has_function_privilege('service_role','public.signup_fence_reserve(uuid,uuid,uuid,text,uuid,text,text,boolean,text)','EXECUTE') AS legacy,has_function_privilege('service_role','public.signup_fence_reserve_origin_v2(uuid,uuid,uuid,text,uuid,text,text,boolean,text,uuid)','EXECUTE') AS v2")).rows[0];assert.equal(acl.legacy,false);assert.equal(acl.v2,true);
 await db.query('UPDATE app_private.signup_intents SET origin_revision=$1 WHERE id=$2',[newRev,intent]);
 assert.equal((await db.query(reserveSql,reserve(rev,false))).rows[0].result.status,'stale');
 assert.equal((await db.query(reserveSql,reserve(null,false))).rows[0].result.status,'stale');
 const row=(await db.query('SELECT origin_revision,origin FROM app_private.signup_intents')).rows[0];assert.equal(row.origin_revision,newRev);assert.ok(row.origin);assert.equal((await db.query('SELECT count(*)::int AS n FROM app_private.signup_completion_fences_draft')).rows[0].n,0);
}finally{await db.close();}});
test('conclusão recusa nova revisão e mantém a prova cercada',async()=>{const db=await database();try{
 assert.equal((await db.query(reserveSql,reserve(rev))).rows[0].result.status,'acquired');
 await db.query('UPDATE app_private.signup_intents SET origin_revision=$1 WHERE id=$2',[newRev,intent]);
 await assert.rejects(db.query(finishSql,finish),/Consent revision changed/);
 assert.equal((await db.query('SELECT phase FROM app_private.signup_completion_fences_draft')).rows[0].phase,'reserved');
}finally{await db.close();}});
test('retirada posterior permite finalizar sem origem, mas reconsentimento exige nova escolha',async()=>{const db=await database();try{
 await db.query(reserveSql,reserve(rev));await db.query('UPDATE app_private.signup_intents SET origin=NULL,origin_revision=NULL WHERE id=$1',[intent]);await db.query('UPDATE app_private.signup_completion_fences_draft SET origin_withdrawn=true');
 await db.query("UPDATE app_private.signup_intents SET origin='{}'::jsonb,origin_revision=$1 WHERE id=$2",[newRev,intent]);await assert.rejects(db.query(finishSql,finish),/Consent revision changed/);
 await db.query('UPDATE app_private.signup_intents SET origin=NULL,origin_revision=NULL WHERE id=$1',[intent]);assert.equal((await db.query(finishSql,finish)).rows[0].result,true);
}finally{await db.close();}});
test('desmarcar ao retomar fence reconhecido retira somente a revisão mostrada na mesma reserva',async()=>{const db=await database();try{
 await db.query(reserveSql,reserve(rev));await db.query("UPDATE app_private.signup_completion_fences_draft SET phase='password_acknowledged'");
 assert.equal((await db.query(reserveSql,reserve(rev,false))).rows[0].result.status,'acknowledged');
 assert.equal((await db.query('SELECT origin FROM app_private.signup_intents')).rows[0].origin,null);
 assert.equal((await db.query('SELECT origin_withdrawn FROM app_private.signup_completion_fences_draft')).rows[0].origin_withdrawn,true);
}finally{await db.close();}});
test('fence sem snapshot v2 nunca autoriza retirada na reserva',async()=>{const db=await database();try{
 await db.query(reserveSql,reserve(rev));await db.query('UPDATE app_private.signup_completion_fences_draft SET origin_revision_snapshot_set=false');
 await assert.rejects(db.query(reserveSql,reserve(rev,false)),/Unavailable/);
 assert.ok((await db.query('SELECT origin FROM app_private.signup_intents')).rows[0].origin);
}finally{await db.close();}});
