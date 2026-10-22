import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql.ts";

// Disposable catalogue + synthetic metadata only. No Storage/Auth HTTP proof.
test("SPEC08 upload observation: authority, closed state, leases and no domain writes", async () => {
  const db = await createLocalCanonicalSql(), owner = randomUUID(), other = randomUUID(), session = randomUUID(), foreignSession = randomUUID(), upload = randomUUID();
  const original = " original-reservation ", base = [owner, session, upload, "project_cover", original];
  await db.exec("begin");
  try {
    for (const [id, sid] of [[owner, session], [other, foreignSession]]) {
      await db.query("insert into auth.users(id,aud,role,email) values($1,'authenticated','authenticated',$2)", [id, id + "@example.invalid"]);
      await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [sid, id]);
    }
    async function call(args = base, role = "service_role", fn = "public.file_entity_image_upload_observe") {
      assert.ok(["service_role", "anon", "authenticated"].includes(role)); assert.ok(["public.file_entity_image_upload_observe", "app_private.file_entity_image_upload_observe"].includes(fn));
      await db.exec("savepoint observe_probe");
      try { await db.exec("set local role " + role); const row = (await db.query(`select ${fn}($1::uuid,$2::uuid,$3::uuid,$4::text,$5::text) as result`, args)).rows[0].result; await db.exec("reset role; release savepoint observe_probe"); return row; }
      catch (error) { await db.exec("rollback to savepoint observe_probe; release savepoint observe_probe; reset role"); throw error; }
    }
    async function snapshot() {
      return (await db.query(`select jsonb_build_object(
        'reservations',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb) from app_private.upload_reservations t),
        'files',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb) from public.drive_files t),
        'events',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb) from public.domain_events t),
        'receipts',(select coalesce(jsonb_agg(to_jsonb(t) order by user_id,command,client_id),'[]'::jsonb) from app_private.command_receipts t),
        'capture_revision',(select coalesce(jsonb_agg(to_jsonb(t) order by user_id),'[]'::jsonb) from app_private.capture_task_revisions t),
        'project_revision',(select coalesce(jsonb_agg(to_jsonb(t) order by user_id),'[]'::jsonb) from app_private.projects_habits_revisions t),
        'finance_revision',(select coalesce(jsonb_agg(to_jsonb(t) order by user_id),'[]'::jsonb) from app_private.finance_revisions t),
        'vault_revision',(select coalesce(jsonb_agg(to_jsonb(t) order by user_id),'[]'::jsonb) from app_private.vault_revisions t)
      ) as state`)).rows[0].state;
    }
    const signature = "file_entity_image_upload_observe(uuid,uuid,uuid,text,text)";
    for (const schema of ["public", "app_private"]) {
      const sig = schema + "." + signature;
      for (const role of ["anon", "authenticated", "service_role"]) assert.equal((await db.query("select has_function_privilege($1::name,$2::text,'EXECUTE') as allowed", [role, sig])).rows[0].allowed, role === "service_role");
      const meta = (await db.query("select p.prosecdef,p.provolatile,coalesce('search_path=\"\"'=any(p.proconfig),false) as closed_path from pg_proc p where p.oid=$1::regprocedure", [sig])).rows[0];
      assert.equal(meta.prosecdef, schema === "app_private"); assert.equal(meta.provolatile, "v"); assert.equal(meta.closed_path, true);
    }
    await db.query("select public.file_upload_reserve($1,$2,'project_cover','synthetic.png',null,$3,$4,8388608,1073741824,clock_timestamp()+interval '2 hours')", [owner, session, original, upload]);
    for (const kind of ["home_focus_image", "habit_image", "finance_goal_image"]) {
      const image = randomUUID();
      await db.query("select public.file_upload_reserve($1,$2,$3,'synthetic.png',null,$4,$5,8388608,1073741824,clock_timestamp()+interval '2 hours')", [owner, session, kind, original, image]);
      assert.equal((await call([owner, session, image, kind, original])).kind, kind);
    }
    const before = await snapshot(), observed = await call();
    assert.deepEqual(Object.keys(observed).sort(), ["expires_at", "file", "kind", "observed_at", "processing", "status", "upload_id", "user_id", "version"]);
    assert.equal(observed.version, 1); assert.equal(observed.user_id, owner); assert.equal(observed.upload_id, upload); assert.equal(observed.kind, "project_cover");
    assert.equal(observed.status, "reserved"); assert.equal(observed.processing, false); assert.equal(observed.file, null); assert.ok(Date.parse(observed.expires_at) > Date.parse(observed.observed_at));
    assert.match(observed.observed_at, /T.*(?:Z|[+-]\d\d:\d\d)$/);
    await call(); assert.deepEqual(await snapshot(), before);
    for (const role of ["anon", "authenticated"]) for (const fn of ["public.file_entity_image_upload_observe", "app_private.file_entity_image_upload_observe"]) await assert.rejects(call(base, role, fn), error => error.code === "42501");
    for (const index of [0, 1, 2, 3, 4]) { const args = [...base]; args[index] = null; await assert.rejects(call(args), error => error.code === "22023"); }
    for (const args of [[owner, foreignSession, upload, "project_cover", original], [other, foreignSession, upload, "project_cover", original], [owner, session, randomUUID(), "project_cover", original], [owner, session, upload, "home_focus_image", original], [owner, session, upload, "project_cover", original.trim()], [owner, session, upload, "project_cover", "finalize-id"]]) await assert.rejects(call(args), error => error.code === "42501");
    for (const args of [[owner, session, upload, "drive", original], [owner, session, upload, "project_cover", " "], [owner, session, upload, "project_cover", "x".repeat(201)]]) await assert.rejects(call(args), error => error.code === "22023");
    assert.deepEqual(await snapshot(), before);
    await db.query("update app_private.upload_reservations set status='processing',lease_id=$2,lease_until=clock_timestamp()+interval '5 minutes' where id=$1", [upload, randomUUID()]);
    const active = await snapshot(); assert.equal((await call()).processing, true); assert.deepEqual(await snapshot(), active);
    await db.query("update app_private.upload_reservations set lease_until=clock_timestamp()-interval '1 second' where id=$1", [upload]);
    const expiredLease = await snapshot(), processing = await call(); assert.equal(processing.status, "processing"); assert.equal(processing.processing, false); assert.deepEqual(await snapshot(), expiredLease);
    await db.query("update app_private.upload_reservations set lease_id=null,lease_until=null where id=$1", [upload]);
    await assert.rejects(call(), error => error.code === "23514");
    await db.query("update app_private.upload_reservations set status='reserved',lease_id=$2,lease_until=clock_timestamp()+interval '1 minute' where id=$1", [upload, randomUUID()]);
    await assert.rejects(call(), error => error.code === "23514");
    await db.query("update app_private.upload_reservations set lease_id=null,lease_until=null,expires_at=clock_timestamp()-interval '1 minute' where id=$1", [upload]);
    const expired = await call(); assert.equal(expired.status, "reserved"); assert.ok(Date.parse(expired.expires_at) < Date.parse(expired.observed_at));
    await db.query("update app_private.upload_reservations set status='expired' where id=$1", [upload]); assert.equal((await call()).status, "expired");
    await db.query("update app_private.upload_reservations set status='reserved',expires_at=clock_timestamp()+interval '2 hours' where id=$1", [upload]);
    const lease = randomUUID(), now = new Date().toISOString();
    await db.query("select public.file_upload_claim($1,$2,$3,$4,'finalize-id')", [owner, session, upload, lease]);
    const file = { id: upload, user_id: owner, kind: "project_cover", folder_id: null, name: "synthetic.png", mime: "image/png", bytes: 100, sha256: "a".repeat(64), width: 2, height: 2, starred: false, deleted_at: null, deletion_batch_id: null, created_at: now, updated_at: now, modified_at: now };
    await db.query("select public.file_upload_complete($1,$2,$3,$4,'finalize-id',$5::jsonb,1073741824)", [owner, session, upload, lease, JSON.stringify(file)]);
    await db.query("update app_private.upload_reservations set expires_at=clock_timestamp()-interval '1 day' where id=$1", [upload]);
    const finalBefore = await snapshot(), final = await call(); assert.deepEqual(final.file, file); assert.equal(final.status, "finalized"); assert.equal(final.processing, false); assert.deepEqual(await snapshot(), finalBefore);
    await db.query("update app_private.upload_reservations set status='reserved' where id=$1", [upload]); await assert.rejects(call(), error => error.code === "23514");
    await db.query("update app_private.upload_reservations set status='processing',lease_id=$2,lease_until=clock_timestamp()+interval '1 minute' where id=$1", [upload, randomUUID()]); await assert.rejects(call(), error => error.code === "23514");
    await db.query("update app_private.upload_reservations set status='finalized',lease_id=null,lease_until=null where id=$1", [upload]);
    await db.query("insert into public.user_entitlements(user_id,feature_key,allowed) values($1,'projetos',false)", [owner]);
    const vetoBefore = await snapshot(); await assert.rejects(call(), error => error.code === "42501"); assert.deepEqual(await snapshot(), vetoBefore);
    await db.query("delete from public.user_entitlements where user_id=$1 and feature_key='projetos'", [owner]);
    await db.query("update public.user_moderation set must_change_password=true where user_id=$1", [owner]); await assert.rejects(call(), error => error.code === "42501");
    await db.query("update public.user_moderation set must_change_password=false,status='blocked' where user_id=$1", [owner]); await assert.rejects(call(), error => error.code === "42501");
    await db.query("update public.user_moderation set status='active' where user_id=$1", [owner]);
    await db.query("update public.drive_files set payload=payload||jsonb_build_object('deleted_at',clock_timestamp(),'deletion_batch_id',gen_random_uuid()) where id=$1", [upload]);
    const removed = await snapshot(); await assert.rejects(call(), error => error.code === "23514"); assert.deepEqual(await snapshot(), removed);
    await db.query("update public.drive_files set purged_at=clock_timestamp() where id=$1", [upload]); await assert.rejects(call(), error => error.code === "23514");
    await db.query("delete from auth.sessions where id=$1", [session]); await assert.rejects(call(), error => error.code === "42501");
  } finally { await db.exec("rollback"); await db.close(); }
});
